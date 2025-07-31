import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Checkbox } from 'expo-checkbox';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Todo = {
  id: number;
  title: string;
  isDone: boolean;
  scheduledTime?: number; // timestamp in ms
  notificationId?: string;
};

export default function Index() {
  // Toast state and component (must be inside component)
  const [toast, setToast] = useState<{visible: boolean, message: string, type: 'success'|'error'}>({visible: false, message: '', type: 'success'});
  const toastAnim = useRef(new Animated.Value(0)).current;
  const editInputRef = useRef<TextInput>(null);

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({visible: true, message, type});
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        }).start(() => setToast(t => ({...t, visible: false})));
      }, 1600);
    });
  };

  // Handle time picker change (must be inside component)
  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setScheduledTime(selectedDate);
    }
  };
  const TODOS_KEY = 'todos';
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState("");
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editTask, setEditTask] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>("light");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.8)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  // Ask notification permissions on mount
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // Load todos from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TODOS_KEY);
        if (saved) setTodos(JSON.parse(saved));
      } catch {}
    })();
  }, []);

  // Save todos to AsyncStorage whenever they change
  useEffect(() => {
    AsyncStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  }, [todos]);

  const handleAddTask = async () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    const exists = todos.some(t => t.title.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast("A task with this name already exists.", 'error');
      return;
    }
    let notificationId: string | undefined = undefined;
    let scheduledTimestamp: number | undefined = undefined;
    if (scheduledTime) {
      scheduledTimestamp = scheduledTime.getTime();
      if (scheduledTimestamp > Date.now()) {
        // Schedule notification at specific date/time
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Task Reminder',
            body: trimmed,
            sound: true,
          },
          trigger: new Date(scheduledTimestamp) as any
        });
        notificationId = id;
      }
    }
    setTodos(prev => [
      { id: Date.now(), title: trimmed, isDone: false, scheduledTime: scheduledTimestamp, notificationId },
      ...prev
    ]);
    setNewTask("");
    setShowInput(false);
    setScheduledTime(null);
    showToast("Task added!", 'success');
  };

  const handleDelete = async (id: number) => {
    const task = todos.find(t => t.id === id);
    if (task?.notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(task.notificationId);
      } catch {}
    }
    setTodos(prev => prev.filter(t => t.id !== id));
    showToast("Task deleted!", 'success');
  };

  const handleToggle = async (id: number) => {
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        if (!t.isDone) {
          // If marking as done, cancel notification if exists
          if (t.notificationId) {
            Notifications.cancelScheduledNotificationAsync(t.notificationId).catch(() => {});
          }
          showToast('Task is Completed', 'success');
        }
        return { ...t, isDone: !t.isDone, notificationId: !t.isDone ? undefined : t.notificationId };
      }
      return t;
    }));
  };

  const handleEdit = (id: number, title: string) => {
    setEditId(id);
    setEditTask(title);
    setModalVisible(true);
  };

  useEffect(() => {
    if (modalVisible) {
      Animated.parallel([
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 200);
    } else {
      modalScale.setValue(0.8);
      modalOpacity.setValue(0);
    }
  }, [modalVisible]);

  // Animate todo list fade in
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
  }, []);

  const handleUpdate = () => {
    const trimmed = editTask.trim();
    if (!trimmed) {
      showToast("Task name cannot be empty.", 'error');
      return;
    }
    const exists = todos.some(t => t.title.trim().toLowerCase() === trimmed.toLowerCase() && t.id !== editId);
    if (exists) {
      showToast("A task with this name already exists.", 'error');
      return;
    }
    setTodos(prev => prev.map(t => t.id === editId ? { ...t, title: trimmed } : t));
    setModalVisible(false);
    setEditTask("");
    setEditId(null);
    showToast("Task updated!", 'success');
  };

  const filteredTodos = todos.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  // Theme color palettes
  const themes = {
    light: {
      background: '#f5f5f5',
      card: '#fff',
      border: '#111',
      text: '#222',
      faded: '#888',
      accent: '#2980b9',
      done: 'green',
      fab: '#2980b9',
      addBtn: '#27ae60',
      cancelBtn: '#e74c3c',
      modalBg: '#fff',
      modalOverlay: 'rgba(0,0,0,0.3)',
      footer: 'transparent',
      footerText: '#888',
      inputBg: '#f8fafd',
      placeholder: '#aaa',
    },
    dark: {
      background: '#181a20',
      card: '#23262f',
      border: '#e0e0e0', // dark white for borders
      text: '#f5f6fa',
      faded: '#aaa',
      accent: '#00b894',
      done: '#00b894',
      fab: '#00b894',
      addBtn: '#0984e3',
      cancelBtn: '#d63031',
      modalBg: '#23262f',
      modalOverlay: 'rgba(0,0,0,0.7)',
      footer: 'transparent',
      footerText: '#aaa',
      inputBg: '#23262f',
      placeholder: '#888',
    }
  };
  const currentTheme = themes[theme];

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: currentTheme.background}]}> 
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.header}>
          <View style={{flexDirection: 'column', flex: 1}}>
            <Text style={{fontSize: 22, fontWeight: 'bold', color: currentTheme.accent, letterSpacing: 1}}>Taskify</Text>
            <Text style={{fontSize: 13, color: currentTheme.faded, marginTop: 2}}>Your Smart Todo & Reminder App</Text>
          </View>
          {/* Theme Toggle Button */}
          <TouchableOpacity onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')} style={{marginLeft: 10}}>
            <Ionicons name={theme === 'light' ? 'moon' : 'sunny'} size={26} color={currentTheme.accent} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchBar, {backgroundColor: currentTheme.card, shadowColor: currentTheme.text}]}> 
          <Ionicons name='search' size={24} color={currentTheme.faded}/>
          <TextInput
            placeholder='Search tasks...'
            style={[styles.searchInput, {color: currentTheme.text}]}
            clearButtonMode="always"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={currentTheme.placeholder}
          />
        </View>
        <Animated.View style={{flex:1, opacity: fadeAnim}}>
          <FlatList
            data={filteredTodos}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{paddingBottom: 100}}
            renderItem={({item}) => {
              const isLongTask = item.title.length > 7; // adjust threshold as needed
              return (
                <Animated.View style={[styles.todoCard, {backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.text}]}> 
                  {isLongTask ? (
                    <View style={{flexDirection: 'column', flex: 1}}>
                      <View style={{flexDirection: 'row', alignItems: 'center', flex: 1, marginBottom: 2}}>
                        <TouchableOpacity onPress={() => handleToggle(item.id)} style={styles.checkCircle}>
                          <Checkbox value={item.isDone} onValueChange={() => handleToggle(item.id)} color={item.isDone ? currentTheme.accent : currentTheme.border} style={[styles.checkboxCustom, {borderColor: currentTheme.border}]} />
                        </TouchableOpacity>
                        <Text style={[
                          styles.todoText,
                          {color: currentTheme.text, fontSize: 18, flexShrink: 1, flexWrap: 'wrap', textAlign: 'justify'},
                          item.isDone && {textDecorationLine:'line-through', color: currentTheme.done, opacity: 0.7},
                          {marginLeft: 8, marginRight: 0}
                        ]}>{item.title}</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flex: 1, marginTop: 2}}>
                        {item.scheduledTime && (
                          <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 12}}>
                            <Ionicons name="time-outline" size={20} color={currentTheme.faded} style={{marginRight: 3}} />
                            <Text style={{color: currentTheme.faded, fontSize: 18, lineHeight: 24, paddingTop: 1}}>
                              {new Date(item.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity onPress={() => handleEdit(item.id, item.title)} style={styles.actionBtn}>
                          <Ionicons name="create-outline" size={22} color={currentTheme.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                          <Ionicons name="trash" size={22} color={currentTheme.cancelBtn} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.todoRow, {alignItems: 'center'}]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                        <TouchableOpacity onPress={() => handleToggle(item.id)} style={styles.checkCircle}>
                          <Checkbox value={item.isDone} onValueChange={() => handleToggle(item.id)} color={item.isDone ? currentTheme.accent : currentTheme.border} style={[styles.checkboxCustom, {borderColor: currentTheme.border}]} />
                        </TouchableOpacity>
                        <Text style={[styles.todoText, {color: currentTheme.text, fontSize: 18, flexShrink: 1, flexWrap: 'wrap'}, item.isDone && {textDecorationLine:'line-through', color: currentTheme.done, opacity: 0.7}, {marginLeft: 8, marginRight: 0}]}>{item.title}</Text>
                        {item.scheduledTime && (
                          <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 8}}>
                            <Ionicons name="time-outline" size={20} color={currentTheme.faded} style={{marginRight: 3}} />
                            <Text style={{color: currentTheme.faded, fontSize: 18, lineHeight: 24, paddingTop: 1}}>
                              {new Date(item.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.todoActions}>
                        <TouchableOpacity onPress={() => handleEdit(item.id, item.title)} style={styles.actionBtn}>
                          <Ionicons name="create-outline" size={22} color={currentTheme.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                          <Ionicons name="trash" size={22} color={currentTheme.cancelBtn} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </Animated.View>
              );
            }}
            ListEmptyComponent={<Text style={[styles.emptyText, {color: currentTheme.faded}]}>No tasks found.</Text>}
          />
        </Animated.View>

        {/* Floating Add Button */}
        {!showInput && (
          <TouchableOpacity style={[styles.fab, {backgroundColor: currentTheme.fab, shadowColor: currentTheme.text}]} onPress={() => setShowInput(true)}>
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
        )}
        {/* DateTimePicker for scheduling */}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledTime || new Date()}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}
        {/* Animated Add Task Input */}
        {showInput && (
          <Animated.View style={[styles.addTaskBarAnimated, {backgroundColor: currentTheme.card, shadowColor: currentTheme.text}]}> 
            <TextInput
              placeholder="Add a new task"
              value={newTask}
              onChangeText={setNewTask}
              style={[styles.addTaskInput, {color: currentTheme.text}]}
              onSubmitEditing={handleAddTask}
              placeholderTextColor={currentTheme.placeholder}
              autoFocus
            />
            {/* Time Picker Button */}
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.addTaskBtn, {backgroundColor: currentTheme.accent}]}> 
              <Ionicons name="time" size={24} color="#fff" />
            </TouchableOpacity>
            {/* Show selected time if set */}
            {scheduledTime && (
              <View style={{marginLeft: 4, marginRight: 4}}>
                <Text style={{color: currentTheme.faded, fontSize: 13}}>
                  {scheduledTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={handleAddTask} style={[styles.addTaskBtn, {backgroundColor: currentTheme.addBtn}]}> 
              <Ionicons name="checkmark" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowInput(false); setNewTask(""); setScheduledTime(null); }} style={[styles.addTaskBtnCancel, {backgroundColor: currentTheme.cancelBtn}]}> 
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Animated Modal */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="none"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={[styles.modalOverlay, {backgroundColor: currentTheme.modalOverlay}]}> 
            <Animated.View style={[styles.modalContent, {backgroundColor: currentTheme.modalBg, shadowColor: currentTheme.text}]}> 
              <Text style={{fontWeight:'bold', fontSize:20, marginBottom:16, color:currentTheme.text, textAlign:'center'}}>Edit Task</Text>
              <TextInput
                ref={editInputRef}
                value={editTask}
                onChangeText={setEditTask}
                style={[styles.modalEditInput, {color: currentTheme.text, backgroundColor: currentTheme.inputBg, borderColor: currentTheme.border}]}
                placeholder="Edit task name"
                placeholderTextColor={currentTheme.placeholder}
                editable={true}
                returnKeyType="done"
                onSubmitEditing={handleUpdate}
              />
              <View style={{flexDirection:'row', justifyContent:'flex-end', gap:10, marginTop:18}}>
                <Pressable onPress={() => setModalVisible(false)} style={[styles.cancelBtn, {backgroundColor: currentTheme.card}]}> 
                  <Text style={{color:currentTheme.text, fontWeight:'bold'}}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleUpdate} style={[styles.saveBtn, {backgroundColor: currentTheme.addBtn}]}> 
                  <Text style={{color:'#fff', fontWeight:'bold'}}>Save</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
      {/* Footer outside KeyboardAvoidingView so it always sticks to bottom */}
      <View pointerEvents="none" style={[styles.footer, {backgroundColor: currentTheme.footer}]}> 
        <Text style={[styles.footerText, {color: currentTheme.footerText}]}>Developed By - Nishant Wale</Text>
      </View>

      {/* Toast Popup */}
      {toast.visible && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 999,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({inputRange: [0,1], outputRange: [-40,0]}) }],
        }}>
          <View style={{
            backgroundColor: toast.type === 'success' ? '#27ae60' : '#e74c3c',
            paddingHorizontal: 28,
            paddingVertical: 14,
            borderRadius: 18,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 8,
            minWidth: 180,
            alignItems: 'center',
          }}>
            <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center'}}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container : {
    flex: 1,
    paddingHorizontal:20,
    backgroundColor:'#f5f5f5',
  },
  header : {
    flexDirection : 'row',
    justifyContent : 'space-between',
    alignItems : 'center',
    marginBottom: 18,
    marginTop: Platform.OS === 'android' ? 32 : 20,
    paddingTop: 8,
  },
  // avatar removed
  searchBar : {
    flexDirection : 'row',
    alignItems: 'center',
    backgroundColor : '#fff',
    paddingHorizontal : 16,
    paddingVertical: 10,
    borderRadius : 16,
    gap : 10,
    marginBottom : 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex : 1,
    fontSize : 17,
    color : "#222",
    height: 40,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  todoCard: {
    backgroundColor: '#fff',
    borderRadius: 10, // Slight curve
    borderWidth: 1.5,
    borderColor: '#111', // Dark black border
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  todoText: {
    flexShrink: 1,
    fontSize: 20,
    color: '#222',
    marginLeft: 12,
    marginRight: 8,
    textAlign: 'left',
  },
  todoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  checkCircle: {
    marginRight: 2,
    borderRadius: 16,
    backgroundColor: 'transparent',
    padding: 2,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    color: 'green',
    opacity: 0.7,
  },
  addTaskBarAnimated: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 8, // reduced from 16
    paddingVertical: 10,
    marginHorizontal: 4, // reduced from 16
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 6,
    gap: 10,
    zIndex: 10,
  },
  fab: {
    position: 'absolute',
    right: 28,
    bottom: 32,
    backgroundColor: '#2980b9',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  addTaskBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 10,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  addTaskBtnCancel: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    alignSelf: 'center',
  },
  cancelBtn: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginRight: 2,
  },
  saveBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 2,
  },
  modalEditInput: {
    fontSize: 17,
    color: '#222',
    height: 44,
    borderWidth: 1.5,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafd',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#bbb',
    marginTop: 32,
    fontSize: 16,
    fontStyle: 'italic',
  },
  addTaskInput: {
    flex: 1,
    fontSize: 20,
    color: '#222',
    height: 52,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    marginRight: 2, // reduced from 8
  },
  checkboxCustom: {
    borderWidth: 1.5,
    borderRadius: 1,
    width: 22,
    height: 22,
    borderColor : 'black'
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    // pointerEvents: 'none' is set on the View directly
  },
  footerText: {
    color: '#888',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5
  }
});
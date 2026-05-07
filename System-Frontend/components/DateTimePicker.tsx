import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onDateTimeSelect: (dateTime: string) => void;
  initialDate?: string;
  showTime?: boolean;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  visible,
  onClose,
  onDateTimeSelect,
  initialDate,
  showTime = false,
}) => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate ? new Date(initialDate) : today
  );
  const [selectedHour, setSelectedHour] = useState(selectedDate.getHours());
  const [selectedMinute, setSelectedMinute] = useState(selectedDate.getMinutes());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (showTime) {
      const hour = String(selectedHour).padStart(2, '0');
      const minute = String(selectedMinute).padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  const handleConfirm = () => {
    onDateTimeSelect(formatDateString(selectedDate));
    onClose();
  };

  const handlePrevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));
  };

  const daysInMonth = getDaysInMonth(selectedDate);
  const firstDay = getFirstDayOfMonth(selectedDate);
  const monthName = new Date(selectedDate.getFullYear(), selectedDate.getMonth()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color="#666" />
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>SELECT_DATE</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Ionicons name="checkmark" size={26} color="#00FF66" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Month Navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
                <Text style={styles.monthNavArrow}>[ {'<'} ]</Text>
              </TouchableOpacity>
              <Text style={styles.monthName}>{monthName}</Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
                <Text style={styles.monthNavArrow}>[ {'>'} ]</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekdayRow}>
              {weekDays.map((day) => (
                <Text key={day} style={styles.weekdayText}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            {weeks.map((week, weekIdx) => (
              <View key={weekIdx} style={styles.calendarWeek}>
                {week.map((day, dayIdx) => {
                  const isSelected =
                    day &&
                    day === selectedDate.getDate() &&
                    selectedDate.getMonth() === new Date().getMonth();
                  const isToday = day === new Date().getDate();

                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      style={[
                        styles.calendarDay,
                        isSelected ? styles.calendarDaySelected : {},
                        isToday && !isSelected ? styles.calendarDayToday : {},
                      ]}
                      onPress={() => day && handleDateSelect(day)}
                      disabled={!day}
                    >
                      {day && (
                        <Text
                          style={[
                            styles.calendarDayText,
                            isSelected ? styles.calendarDayTextSelected : {},
                            isToday && !isSelected ? styles.calendarDayTextToday : {},
                          ]}
                        >
                          {day}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Time Picker */}
            {showTime && (
              <View style={styles.timePicker}>
                <Text style={styles.timeLabel}>/ TIME</Text>
                <View style={styles.timeInputRow}>
                  {/* Hour */}
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.timeInputLabel}>HOUR</Text>
                    <ScrollView
                      style={styles.timeScroll}
                      scrollEventThrottle={16}
                      snapToInterval={40}
                      showsVerticalScrollIndicator={false}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.timeOption,
                            selectedHour === i && styles.timeOptionSelected,
                          ]}
                          onPress={() => setSelectedHour(i)}
                        >
                          <Text
                            style={[
                              styles.timeOptionText,
                              selectedHour === i && styles.timeOptionTextSelected,
                            ]}
                          >
                            {String(i).padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Minute */}
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.timeInputLabel}>MINUTE</Text>
                    <ScrollView
                      style={styles.timeScroll}
                      scrollEventThrottle={16}
                      snapToInterval={40}
                      showsVerticalScrollIndicator={false}
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.timeOption,
                            selectedMinute === i && styles.timeOptionSelected,
                          ]}
                          onPress={() => setSelectedMinute(i)}
                        >
                          <Text
                            style={[
                              styles.timeOptionText,
                              selectedMinute === i && styles.timeOptionTextSelected,
                            ]}
                          >
                            {String(i).padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.98)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    borderRadius: 0,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#000',
  },
  pickerTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 16,
    fontFamily: 'Courier New',
    letterSpacing: 2,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  monthNavBtn: {
    padding: 8,
  },
  monthName: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 16,
    fontFamily: 'Courier New',
    letterSpacing: 1,
  },
  monthNavArrow: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 18,
    fontFamily: 'Courier New',
    letterSpacing: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 2,
  },
  weekdayText: {
    flex: 1,
    color: '#666',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: 'Courier New',
    textAlign: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  calendarWeek: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 2,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  calendarDaySelected: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
    borderWidth: 2,
  },
  calendarDayToday: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  calendarDayText: {
    color: '#999',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Courier New',
  },
  calendarDayTextSelected: {
    color: '#000',
    fontWeight: '900',
  },
  calendarDayTextToday: {
    color: '#FFD700',
    fontWeight: '900',
  },
  timePicker: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
  },
  timeLabel: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    fontFamily: 'Courier New',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeInputLabel: {
    color: '#666',
    fontWeight: '700',
    fontSize: 10,
    fontFamily: 'Courier New',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  timeScroll: {
    height: 150,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  timeOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    minHeight: 40,
  },
  timeOptionSelected: {
    backgroundColor: 'rgba(0, 255, 102, 0.1)',
    borderBottomColor: '#00FF66',
  },
  timeOptionText: {
    color: '#999',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: 'Courier New',
  },
  timeOptionTextSelected: {
    color: '#00FF66',
    fontWeight: '900',
  },
});

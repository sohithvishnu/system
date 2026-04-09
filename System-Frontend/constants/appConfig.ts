/**
 * Frontend Application Configuration
 * Centralizes UI settings, time formats, and application behaviors
 */

/**
 * TIME & DATE FORMATS
 * Control how time is displayed throughout the app
 */
export const TIME_CONFIG = {
  // Display formats
  FULL_DATETIME_FORMAT: "MMM dd, yyyy - h:mm a",     // "Apr 09, 2026 - 02:30 PM"
  TIME_ONLY_FORMAT: "h:mm a",                        // "02:30 PM"
  SHORT_TIME_FORMAT: "HH:mm",                        // "14:30"
  DATE_ONLY_FORMAT: "MMM dd, yyyy",                  // "Apr 09, 2026"
  DAY_FORMAT: "EEEE",                                // "Wednesday"
  
  // Timezone (should match backend TIMEZONE)
  TIMEZONE: "CET",
  
  // Update interval for time display (milliseconds)
  CLOCK_UPDATE_INTERVAL: 60000, // Update every minute
  
  // Time periods for context-aware UI
  TIME_PERIODS: {
    MORNING: { start: 5, end: 12, label: "Morning" },
    AFTERNOON: { start: 12, end: 17, label: "Afternoon" },
    EVENING: { start: 17, end: 21, label: "Evening" },
    NIGHT: { start: 21, end: 5, label: "Night" },
  },
};

/**
 * CHAT CONFIGURATION
 * Settings for chat UI and behavior
 */
export const CHAT_CONFIG = {
  // Display current time in chat header
  SHOW_TIME_IN_HEADER: true,
  
  // Update time display frequency (milliseconds)
  TIME_UPDATE_INTERVAL: 60000,
  
  // Show time period indicator (morning/afternoon/etc)
  SHOW_TIME_PERIOD: true,
  
  // Default system prompt mode when starting chat
  DEFAULT_PROMPT_MODE: "default", // options: default, analytical, code, creative
  
  // Available prompt modes for user to switch between
  AVAILABLE_PROMPT_MODES: [
    { id: "default", label: "System", description: "Conversational companion" },
    { id: "analytical", label: "Analytical", description: "Precision-focused" },
    { id: "code", label: "Code", description: "Programming expert" },
    { id: "creative", label: "Creative", description: "Imaginative brainstorming" },
  ],
  
  // Message display animations
  ANIMATE_MESSAGES: true,
  MESSAGE_ANIMATION_DURATION: 300, // milliseconds
  
  // Maximum message length before truncation
  MAX_MESSAGE_LENGTH: 5000,
  
  // Show task indicators in messages
  SHOW_TASK_INDICATORS: true,
};

/**
 * UI TIME AWARENESS
 * Context-sensitive UI behavior based on time of day
 */
export const UI_TIME_AWARENESS = {
  // Theme brightness adjustment based on time
  ENABLE_TIME_BASED_THEME: true,
  
  // Greeting messages based on time of day
  GREETINGS: {
    morning: ["Good morning!", "Rise and shine!", "Morning, let's get started"],
    afternoon: ["Good afternoon", "Afternoon vibes", "How's it going?"],
    evening: ["Good evening", "Winding down?", "Evening check-in"],
    night: ["Late night session?", "Night owl mode", "Burning the midnight oil"],
  },
  
  // Encouragement based on task urgency and time
  ENABLE_URGENCY_INDICATORS: true,
  
  // Show current workload vs available time
  SHOW_TIME_BLOCKING: false, // Future feature
};

/**
 * NOTIFICATION CONFIGURATION
 * Time-aware notifications and reminders
 */
export const NOTIFICATION_CONFIG = {
  // Enable notifications
  ENABLE_NOTIFICATIONS: true,
  
  // Show time-based task reminders
  SHOW_TASK_REMINDERS: true,
  
  // Quiet hours (don't show notifications)
  QUIET_HOURS_START: 22, // 10 PM
  QUIET_HOURS_END: 7,    // 7 AM
  
  // Notification lead time before task due (minutes)
  REMINDER_LEAD_TIME: 30,
};

/**
 * PERFORMANCE & CACHING
 * Time-based cache invalidation
 */
export const CACHE_CONFIG = {
  // Cache duration for messages (milliseconds)
  MESSAGE_CACHE_DURATION: 3600000, // 1 hour
  
  // Task list cache duration
  TASK_CACHE_DURATION: 300000, // 5 minutes
  
  // Weekly summary cache duration
  SUMMARY_CACHE_DURATION: 3600000, // 1 hour
};

/**
 * DEBUGGING & LOGGING
 * Environment-specific settings
 */
export const DEBUG_CONFIG = {
  // Enable detailed console logging
  ENABLE_DEBUG_LOGS: false,
  
  // Log all time-based decisions
  LOG_TIME_AWARENESS: false,
  
  // Show performance metrics
  SHOW_PERFORMANCE_METRICS: false,
};

/**
 * UTILITY FUNCTION: Get current time period
 */
export function getCurrentTimePeriod(): "morning" | "afternoon" | "evening" | "night" {
  const now = new Date();
  const hour = now.getHours();
  const { MORNING, AFTERNOON, EVENING, NIGHT } = TIME_CONFIG.TIME_PERIODS;
  
  if (hour >= MORNING.start && hour < MORNING.end) return "morning";
  if (hour >= AFTERNOON.start && hour < AFTERNOON.end) return "afternoon";
  if (hour >= EVENING.start && hour < EVENING.end) return "evening";
  return "night";
}

/**
 * UTILITY FUNCTION: Get greeting for current time
 */
export function getGreeting(): string {
  const period = getCurrentTimePeriod();
  const greetings = UI_TIME_AWARENESS.GREETINGS[period];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * UTILITY FUNCTION: Get time period label
 */
export function getTimePeriodDisplay() {
  const period = getCurrentTimePeriod();
  const config = TIME_CONFIG.TIME_PERIODS[period.toUpperCase() as keyof typeof TIME_CONFIG.TIME_PERIODS];
  return {
    period,
    label: config.label,
    display: config.label,
  };
}

/**
 * UTILITY FUNCTION: Check if currently in quiet hours
 */
export function isInQuietHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const { QUIET_HOURS_START, QUIET_HOURS_END } = NOTIFICATION_CONFIG;
  
  if (QUIET_HOURS_START > QUIET_HOURS_END) {
    // Quiet hours span midnight (e.g., 10 PM to 7 AM)
    return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
  } else {
    // Quiet hours within same day
    return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
  }
}

/**
 * UTILITY FUNCTION: Format time for display
 */
export function formatTime(date: Date, format: "full" | "time" | "date" | "short" = "full"): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIME_CONFIG.TIMEZONE,
  };
  
  switch (format) {
    case "time":
      options.hour = "numeric";
      options.minute = "2-digit";
      options.hour12 = true;
      break;
    case "date":
      options.month = "short";
      options.day = "numeric";
      options.year = "numeric";
      break;
    case "short":
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.hour12 = false;
      break;
    default:
      options.month = "short";
      options.day = "numeric";
      options.year = "numeric";
      options.hour = "numeric";
      options.minute = "2-digit";
      options.hour12 = true;
  }
  
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

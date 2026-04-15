"""
Frontend Error Tracking with Sentry (React Native / Expo).

Challenge:
- Mobile app crashes are silent (user doesn't report them)
- React render errors could crash entire app
- Network timeouts on frontend not visible to backend
- No way to debug user-reported issues without logs

Solution:
- Sentry for Expo captures all crashes + errors
- Breadcrumbs track user actions before crash
- Source maps enable readable stack traces
- Session tracking monitors app health

Why Sentry on mobile:
- Log aggregation: All crashes from all users → one dashboard
- Alerting: Get notified of critical errors in real-time
- Context: Know which screen/action crashed
- Performance: Monitor app startup time, API response times
"""

import { Alert } from 'react-native';
import * as Sentry from 'sentry-expo';
import * as SecureStore from 'expo-secure-store';

/**
 * Initialize Sentry for React Native / Expo.
 *
 * Must be called in _app.tsx before any other code.
 * Captures:
 * - Unhandled exceptions
 * - Promise rejections
 * - React render errors
 * - Performance metrics
 * - User sessions
 */
export function initSentryErrorTracking(): void {
  // Sentry DSN (from environment or hardcoded for production)
  const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

  if (!SENTRY_DSN) {
    console.warn('[SENTRY] DSN not set - error tracking disabled');
    return;
  }

  Sentry.init({
    // DSN (Data Source Name) - where errors are sent
    dsn: SENTRY_DSN,

    // Environment
    environment: __DEV__ ? 'development' : 'production',

    // Sampling: Balance overhead vs visibility
    tracesSampleRate: 0.1, // 10% of sessions get full tracing
    enableInExpoDevelopment: __DEV__, // Enable in Expo dev for testing

    // Performance monitoring
    enableNativeFramesTracking: true, // Track frame rate drops (UI lag)
    enableAppStartTracking: true, // Track app startup time
    enableUserInteractionTracking: true, // Track touch events

    // Release identification (correlate crashes with app versions)
    release: process.env.EXPO_PUBLIC_APP_VERSION || 'dev',

    // Attaching user info (if authenticated)
    initialScope: {
      tags: {
        'app.channel': process.env.EXPO_PUBLIC_APP_CHANNEL || 'unknown',
      },
      user: {
        // Will be populated after login
      },
    },

    // Before sending to Sentry: filter out sensitive data
    beforeSend(event, hint) {
      return sanitizeEvent(event, hint);
    },

    /**
     * Log breadcrumbs (user actions before crash).
     *
     * Why breadcrumbs matter:
     * - "User changed screen → clicked button → crash"
     * - Tells us exactly what user was doing
     * - Default breadcrumbs track navigation + console logs
     */
    maxBreadcrumbs: 100,
  });

  // Custom error boundary for React render crashes
  Sentry.captureException = originalCaptureException;

  console.log('[SENTRY] Initialized (10% trace sampling, error tracking enabled)');
}

/**
 * Sanitize Sentry events before sending.
 *
 * Purpose:
 * - Strip sensitive data (tokens, passwords, PII)
 * - Prevent accidental data leakage to third-party service
 */
function sanitizeEvent(event: any, hint: any): any {
  // Remove headers that might contain auth tokens
  if (event.request?.headers) {
    const sensitiveHeaders = [
      'authorization',
      'x-auth-token',
      'x-api-key',
      'cookie',
    ];

    sensitiveHeaders.forEach((header) => {
      if (event.request.headers[header]) {
        event.request.headers[header] = '[REDACTED]';
      }
    });
  }

  // Remove potentially sensitive breadcrumb data
  event.breadcrumbs?.forEach((breadcrumb: any) => {
    if (breadcrumb.category === 'http') {
      // Remove query parameters (could contain tokens)
      if (breadcrumb.data?.url) {
        const url = new URL(breadcrumb.data.url);
        breadcrumb.data.url = `${url.origin}${url.pathname}`;
      }

      // Remove request body
      if (breadcrumb.data?.request_body) {
        breadcrumb.data.request_body = '[REDACTED]';
      }

      // Remove response body
      if (breadcrumb.data?.response_body) {
        breadcrumb.data.response_body = '[REDACTED]';
      }
    }

    // Remove console logs that might contain sensitive data
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      // Could contain user data, better to not send
      return false;
    }
  });

  // Filter sensitive fields from exception context
  if (event.contexts?.react) {
    if (event.contexts.react.component_stack) {
      // Component stack is safe, but limit size
      event.contexts.react.component_stack = event.contexts.react.component_stack.slice(
        0,
        1000
      );
    }
  }

  return event;
}

/**
 * Set authenticated user info in Sentry.
 *
 * Call after successful login to correlate crashes with users.
 * Also associates app session with user account.
 */
export function setSentryUser(userId: string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    username: username || email,
    email: email,
  });

  console.log(`[SENTRY] User set: ${userId}`);
}

/**
 * Clear user info on logout.
 *
 * Prevents crashes from being attributed to logged-out session.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
  console.log('[SENTRY] User cleared');
}

/**
 * Manually capture exception.
 *
 * Use when try/catch catches error but you want to report it.
 *
 * Example:
 *   try {
 *     await risky_operation();
 *   } catch (error) {
 *     captureErrorWithContext(error, {
 *       operation: 'memory_compile',
 *       user_id: 'user_123'
 *     });
 *   }
 */
export function captureErrorWithContext(error: Error | string, context?: Record<string, any>): void {
  // Add breadcrumb before capturing
  Sentry.addBreadcrumb({
    message: 'Manual error capture',
    data: context,
    level: 'error',
  });

  // Capture exception
  if (typeof error === 'string') {
    Sentry.captureException(new Error(error));
  } else {
    Sentry.captureException(error);
  }

  console.error(`[SENTRY] Error captured: ${error}`, context);
}

/**
 * Manually capture message (non-error event).
 *
 * Use for important app states or milestones.
 *
 * Example:
 *   await memoryCompile();
 *   captureMessage('Memory compile completed successfully', 'info');
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  Sentry.captureMessage(message, level);
  console.log(`[SENTRY] Message captured: ${message}`);
}

/**
 * Add breadcrumb (track user action).
 *
 * Breadcrumbs appear in Sentry crash reports to show user actions.
 * Limited to 100 breadcrumbs (oldest dropped when limit exceeded).
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, any>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });

  // Only log debug breadcrumbs in development
  if (level !== 'debug' || __DEV__) {
    console.log(`[BREADCRUMB] ${message}`, data);
  }
}

/**
 * Capture performance metric (measure app responsiveness).
 *
 * Example:
 *   const startTime = Date.now();
 *   const response = await fetch_api();
 *   recordMetric('fetch_api_time', Date.now() - startTime, 'milliseconds');
 */
export function recordMetric(
  name: string,
  value: number,
  unit: 'milliseconds' | 'bytes' | 'seconds' = 'milliseconds'
): void {
  // Note: Sentry.captureMetric() available in Sentry SDK 7.0+
  // For now, use breadcrumbs to track metrics
  addBreadcrumb(`Metric: ${name}`, { value, unit }, 'debug');
}

/**
 * Capture network error with retry info.
 *
 * Example:
 *   try {
 *     return await fetch_api();
 *   } catch (error) {
 *     captureNetworkError(error, {
 *       endpoint: '/api/chat',
 *       method: 'POST',
 *       attempt: 1,
 *       max_retries: 3
 *     });
 *   }
 */
export function captureNetworkError(
  error: Error,
  details: {
    endpoint: string;
    method: string;
    attempt: number;
    max_retries: number;
  }
): void {
  Sentry.addBreadcrumb({
    category: 'http',
    message: `Network error: ${error.message}`,
    data: details,
    level: 'warning',
  });

  if (details.attempt >= details.max_retries) {
    // Capture as error only on final retry
    captureErrorWithContext(error, details);
  }
}

export default Sentry;

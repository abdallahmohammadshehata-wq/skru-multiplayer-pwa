/**
 * Mobile native haptic feedback utility
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'skru'): void {
  if (typeof window === 'undefined' || !navigator.vibrate) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'heavy':
        navigator.vibrate([40, 30, 60]);
        break;
      case 'skru':
        navigator.vibrate([80, 50, 80, 50, 150]);
        break;
    }
  } catch (e) {
    // Vibration not supported or not allowed without user interaction
  }
}

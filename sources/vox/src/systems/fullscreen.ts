// Full-screen + landscape. Browsers only allow entering fullscreen from a user gesture, so
// the game enters on the first tap/key (mobile) and offers a toggle button. Orientation lock
// only works while fullscreen and only on some browsers (mainly Android); it's a no-op on
// iOS and desktop, where the CSS viewport-fit layout + the rotate prompt cover portrait.

import Phaser from 'phaser';

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

export function lockLandscape(): void {
  try {
    const orientation = screen.orientation as LockableOrientation | undefined;
    void orientation?.lock?.('landscape')?.catch(() => undefined);
  } catch {
    /* unsupported (iOS / desktop) — ignore */
  }
}

/** Enter fullscreen (must run inside a user-gesture handler) and lock to landscape. */
export function enterFullscreen(scale: Phaser.Scale.ScaleManager): void {
  try {
    if (!scale.isFullscreen && scale.fullscreen.available) scale.startFullscreen();
  } catch {
    /* fullscreen denied — ignore */
  }
  lockLandscape();
}

/** Toggle fullscreen from a scene (for the on-screen button). */
export function toggleFullscreen(scene: Phaser.Scene): void {
  try {
    if (scene.scale.fullscreen.available) scene.scale.toggleFullscreen();
  } catch {
    /* denied — ignore */
  }
  if (scene.scale.isFullscreen) lockLandscape();
}

// Compatibility bridge while the old main bundle still imports YouTubeRoom.
// YouTube support has been removed: this module performs no network requests,
// registers no player, and always leaves SHIS Stream on the Switch source.
export class YouTubeRoom {
  constructor(
    private readonly changeSource: (source: 'switch' | 'youtube') => Promise<void>,
    _volume: () => number,
    _openExternal: (url: string) => Promise<void>,
  ) {
    const hideRemovedSourceUi = () => {
      const button = document.querySelector<HTMLElement>('#sourceButton');
      if (button) {
        button.hidden = true;
        button.style.display = 'none';
      }
      const dialog = document.querySelector<HTMLDialogElement>('#sourceDialog');
      if (dialog) {
        if (dialog.open) dialog.close();
        dialog.hidden = true;
        dialog.style.display = 'none';
      }
    };
    hideRemovedSourceUi();
    window.addEventListener('shis-host-change', hideRemovedSourceUi);
    void this.changeSource('switch').catch(() => {});
  }

  setVolume(_value: number) {}
  activate() {}

  async refresh(): Promise<void> {
    await this.changeSource('switch');
    // main.ts historically connected Switch in the refresh failure path.
    // Keep that path until the old source-switching glue is removed.
    throw new Error('YouTube source removed');
  }

  async retry(): Promise<void> {
    await this.changeSource('switch');
    throw new Error('YouTube source removed');
  }
}

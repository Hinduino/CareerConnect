import { downloadBlobUrl } from './fileDownload';

describe('downloadBlobUrl', () => {
  it('starts a download through a temporary anchor and revokes the blob URL', () => {
    jest.useFakeTimers();
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlobUrl('blob:resume', 'jane-resume.pdf');

    expect(click).toHaveBeenCalled();
    // The anchor is removed right away but the URL survives long enough for
    // the browser to start the download.
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:resume');

    click.mockRestore();
    jest.useRealTimers();
  });
});

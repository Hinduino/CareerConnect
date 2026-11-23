// Starts a browser download for a blob URL under the given filename, then
// releases the URL once the browser has had time to begin the download.
export function downloadBlobUrl(blobUrl, filename) {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

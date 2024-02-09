chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    console.log(request);
    // This example doesn't use messages yet, but could be for future enhancements
  }
);

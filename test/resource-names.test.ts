import { beforeEachHandle, createWebLocksInstance } from "./helpers";

function code_points(s: string) {
  return [...s]
    .map((c) => "0x" + c.charCodeAt(0).toString(16).toUpperCase())
    .join(" ");
}

describe("Web Locks API: Resources DOMString edge cases", () => {
  beforeEachHandle();

  [
    "", // Empty strings
    "abc\x00def", // Embedded NUL
    "\uD800", // Unpaired low surrogage
    "\uDC00", // Unpaired high surrogage
    "\uDC00\uD800", // Swapped surrogate pair
    "\uFFFF", // Non-character
  ].forEach((string) => {
    test("DOMString: " + code_points(string), async () => {
      const webLocks = createWebLocksInstance();

      await webLocks.request(string, (lock) => {
        // Requested name matches granted name
        expect(lock?.name).toEqual(string);
      });
    });
  });

  test("Resource names that are not valid UTF-16 are not mangled", async () => {
    const webLocks = createWebLocksInstance();

    // '\uD800' treated as a USVString would become '\uFFFD'.
    await webLocks.request("\uD800", async (lock) => {
      expect(lock?.name).toEqual("\uD800");

      // |lock| is held for the duration of this name. It
      // Should not block acquiring |lock2| with a distinct
      // DOMString.
      await webLocks.request("\uFFFD", (lock2) => {
        expect(lock2?.name).toEqual("\uFFFD");
      });

      // If we did not time out, this passed.
    });
  });

  test("Names cannot start with ' - '", async () => {
    const webLocks = createWebLocksInstance();

    for (const name of ["-", "-foo"]) {
      try {
        //Names starting with "-" should be rejected
        await webLocks.request(name, (lock) => {});
      } catch (error) {
        expect(error.message).toEqual(
          "Failed to execute 'request' on 'LockManager': Names cannot start with '-'."
        );
        expect(error instanceof DOMException).toBeTruthy();
      }
    }
    let got_lock = false;
    await webLocks.request("x-anything", (lock) => {
      got_lock = true;
    });
    //Names with embedded "-" should be accepted
    expect(got_lock).toBeTruthy();
  });
});

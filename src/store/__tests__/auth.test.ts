// store/__tests__/auth.test.ts
// Tests for Zustand auth store — user profile, anonymous counter, sign-out

import { useAuthStore, type AppUser } from "../auth";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset store to initial state
    useAuthStore.setState({
      firebaseUser: null,
      user: null,
      idToken: null,
      isAuthLoading: true,
      anonymousMessageCount: 0,
    });
  });

  describe("setUser", () => {
    it("should store Google user with correct displayName and uid", () => {
      const googleUser: AppUser = {
        uid: "google_uid_abc",
        email: "dad@gmail.com",
        phoneNumber: null,
        displayName: "Dad's Name",
        photoURL: "https://photo.google.com/dad.jpg",
        isAnonymous: false,
        isAdmin: false,
      };
      useAuthStore.getState().setUser(googleUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(googleUser);
      expect(state.user?.uid).toBe("google_uid_abc");
      expect(state.user?.displayName).toBe("Dad's Name");
    });

    it("should differentiate between two different users", () => {
      const user1: AppUser = {
        uid: "uid_1",
        email: "user1@gmail.com",
        phoneNumber: null,
        displayName: "User One",
        photoURL: null,
        isAnonymous: false,
        isAdmin: false,
      };
      const user2: AppUser = {
        uid: "uid_2",
        email: "user2@gmail.com",
        phoneNumber: null,
        displayName: "User Two",
        photoURL: null,
        isAnonymous: false,
        isAdmin: false,
      };

      useAuthStore.getState().setUser(user1);
      expect(useAuthStore.getState().user?.uid).toBe("uid_1");

      useAuthStore.getState().setUser(user2);
      expect(useAuthStore.getState().user?.uid).toBe("uid_2");
      expect(useAuthStore.getState().user?.displayName).toBe("User Two");
    });

    it("should store anonymous user with isAnonymous=true", () => {
      const anonUser: AppUser = {
        uid: "anon_uid",
        email: null,
        phoneNumber: null,
        displayName: null,
        photoURL: null,
        isAnonymous: true,
        isAdmin: false,
      };
      useAuthStore.getState().setUser(anonUser);

      const state = useAuthStore.getState();
      expect(state.user?.isAnonymous).toBe(true);
      expect(state.user?.isAdmin).toBe(false);
    });

    it("should store admin user with isAdmin=true", () => {
      const adminUser: AppUser = {
        uid: "admin_uid",
        email: "ravi@yourfinadvisor.com",
        phoneNumber: null,
        displayName: "Ravi",
        photoURL: null,
        isAnonymous: false,
        isAdmin: true,
      };
      useAuthStore.getState().setUser(adminUser);
      expect(useAuthStore.getState().user?.isAdmin).toBe(true);
    });
  });

  describe("anonymous message counter", () => {
    it("should increment count and persist to localStorage", () => {
      const count = useAuthStore.getState().incrementAnonymousMessageCount();
      expect(count).toBe(1);
      expect(localStorageMock.getItem("anon_message_count")).toBe("1");
    });

    it("should track 3 messages then signal sign-in wall", () => {
      const store = useAuthStore.getState();
      store.incrementAnonymousMessageCount(); // 1
      store.incrementAnonymousMessageCount(); // 2
      const third = store.incrementAnonymousMessageCount(); // 3
      expect(third).toBe(3);
      expect(useAuthStore.getState().anonymousMessageCount).toBe(3);

      // At count >= 3, needsSignIn should be true (tested via use-auth hook logic)
      const count = useAuthStore.getState().anonymousMessageCount;
      expect(count >= 3).toBe(true);
    });

    it("should reset count on resetAnonymousMessageCount", () => {
      useAuthStore.getState().incrementAnonymousMessageCount();
      useAuthStore.getState().incrementAnonymousMessageCount();
      useAuthStore.getState().resetAnonymousMessageCount();

      expect(useAuthStore.getState().anonymousMessageCount).toBe(0);
      expect(localStorageMock.getItem("anon_message_count")).toBeNull();
    });
  });

  describe("signOut", () => {
    it("should clear user, token, and firebaseUser", () => {
      useAuthStore.getState().setUser({
        uid: "uid_1",
        email: "test@test.com",
        phoneNumber: null,
        displayName: "Test",
        photoURL: null,
        isAnonymous: false,
        isAdmin: false,
      });
      useAuthStore.getState().setIdToken("some-token");

      useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.idToken).toBeNull();
      expect(state.firebaseUser).toBeNull();
    });
  });

  describe("setIdToken", () => {
    it("should store Firebase ID token", () => {
      useAuthStore.getState().setIdToken("firebase-id-token-xyz");
      expect(useAuthStore.getState().idToken).toBe("firebase-id-token-xyz");
    });

    it("should clear token when set to null", () => {
      useAuthStore.getState().setIdToken("some-token");
      useAuthStore.getState().setIdToken(null);
      expect(useAuthStore.getState().idToken).toBeNull();
    });
  });
});

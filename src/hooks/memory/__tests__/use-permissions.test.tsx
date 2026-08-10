import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/hooks/memory/use-permissions";
import { useAuth } from "@/hooks/use-auth";

jest.mock("@/hooks/use-auth");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function auth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    user: null,
    idToken: null,
    isAuthLoading: false,
    isSignedIn: false,
    isAnonymous: false,
    isAdmin: false,
    needsSignIn: false,
    anonymousMessageCount: 0,
    signInWithGoogle: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    getToken: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>;
}

describe("usePermissions", () => {
  test("anonymous / signed-out user gets every permission false", () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: false, isAdmin: false }));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions["memory.read"]).toBe(false);
    expect(result.current.permissions["memory.admin"]).toBe(false);
  });

  test("a signed-in non-admin gets read/create/correct/forget but not raw/debug/admin", () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: true, isAdmin: false }));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions["memory.read"]).toBe(true);
    expect(result.current.permissions["memory.create"]).toBe(true);
    expect(result.current.permissions["memory.correct"]).toBe(true);
    expect(result.current.permissions["memory.forget"]).toBe(true);
    expect(result.current.permissions["memory.read_raw"]).toBe(false);
    expect(result.current.permissions["memory.debug_retrieval"]).toBe(false);
    expect(result.current.permissions["memory.admin"]).toBe(false);
  });

  test("a signed-in admin additionally gets raw/debug/admin", () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: true, isAdmin: true }));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions["memory.read_raw"]).toBe(true);
    expect(result.current.permissions["memory.debug_retrieval"]).toBe(true);
    expect(result.current.permissions["memory.admin"]).toBe(true);
  });

  test("memory.read_cross_user is ALWAYS false — ADR-005, even for an admin", () => {
    mockUseAuth.mockReturnValue(auth({ isSignedIn: true, isAdmin: true }));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions["memory.read_cross_user"]).toBe(false);
  });

  test("loading reflects the underlying auth session loading state", () => {
    mockUseAuth.mockReturnValue(auth({ isAuthLoading: true }));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.loading).toBe(true);
  });
});

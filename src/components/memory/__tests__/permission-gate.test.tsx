import { render, screen } from "@testing-library/react";
import { PermissionGate } from "@/components/memory/permission-gate";
import { usePermissions } from "@/hooks/memory/use-permissions";

jest.mock("@/hooks/memory/use-permissions");

const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;

function permissions(overrides: Partial<Record<string, boolean>> = {}) {
  return {
    "memory.read": true,
    "memory.create": false,
    "memory.correct": false,
    "memory.forget": false,
    "memory.read_evidence": false,
    "memory.read_raw": false,
    "memory.debug_retrieval": false,
    "memory.read_cross_user": false,
    "memory.admin": false,
    ...overrides,
  } as any;
}

describe("PermissionGate", () => {
  test("renders children when the permission is granted", () => {
    mockUsePermissions.mockReturnValue({ permissions: permissions({ "memory.create": true }), loading: false });
    render(
      <PermissionGate perm="memory.create">
        <button>Add memory</button>
      </PermissionGate>,
    );
    expect(screen.getByText("Add memory")).toBeInTheDocument();
  });

  test("hides children when the permission is missing", () => {
    mockUsePermissions.mockReturnValue({ permissions: permissions({ "memory.create": false }), loading: false });
    render(
      <PermissionGate perm="memory.create">
        <button>Add memory</button>
      </PermissionGate>,
    );
    expect(screen.queryByText("Add memory")).not.toBeInTheDocument();
  });

  test("renders the fallback when the permission is missing and a fallback is given", () => {
    mockUsePermissions.mockReturnValue({ permissions: permissions({ "memory.create": false }), loading: false });
    render(
      <PermissionGate perm="memory.create" fallback={<span>Locked</span>}>
        <button>Add memory</button>
      </PermissionGate>,
    );
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.queryByText("Add memory")).not.toBeInTheDocument();
  });

  test("renders nothing while permissions are still loading, even if eventually granted", () => {
    mockUsePermissions.mockReturnValue({ permissions: permissions({ "memory.create": true }), loading: true });
    render(
      <PermissionGate perm="memory.create">
        <button>Add memory</button>
      </PermissionGate>,
    );
    expect(screen.queryByText("Add memory")).not.toBeInTheDocument();
  });

  test("memory.read_cross_user is always false (ADR-005) regardless of mock — a gate on it never shows", () => {
    mockUsePermissions.mockReturnValue({ permissions: permissions({ "memory.read_cross_user": false }), loading: false });
    render(
      <PermissionGate perm="memory.read_cross_user">
        <span>Foreign user data</span>
      </PermissionGate>,
    );
    expect(screen.queryByText("Foreign user data")).not.toBeInTheDocument();
  });
});

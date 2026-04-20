import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/features/auth/AuthGate";
import { EMULATOR_QA_PASSWORD } from "@/lib/firebase/emulatorQa";

const authProviderMocks = vi.hoisted(() => ({
  useAuthContext: vi.fn()
}));

const firebaseAuthMocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  sendEmailLink: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signInAnonymouslyUser: vi.fn()
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuthContext: authProviderMocks.useAuthContext
}));

vi.mock("@/lib/firebase/client", () => ({
  isFirebaseConfigured: true
}));

vi.mock("@/config/env", () => ({
  useFirebaseEmulators: true
}));

vi.mock("@/lib/firebase/auth", async () => {
  const emulatorQa = await import("@/lib/firebase/emulatorQa");
  return {
    ...emulatorQa,
    signInWithGoogle: firebaseAuthMocks.signInWithGoogle,
    sendEmailLink: firebaseAuthMocks.sendEmailLink,
    signInWithEmailPassword: firebaseAuthMocks.signInWithEmailPassword,
    signInAnonymouslyUser: firebaseAuthMocks.signInAnonymouslyUser
  };
});

describe("AuthGate", () => {
  beforeEach(() => {
    authProviderMocks.useAuthContext.mockReturnValue({ user: null, loading: false });
    firebaseAuthMocks.signInWithGoogle.mockResolvedValue(undefined);
    firebaseAuthMocks.sendEmailLink.mockResolvedValue(undefined);
    firebaseAuthMocks.signInWithEmailPassword.mockResolvedValue(undefined);
    firebaseAuthMocks.signInAnonymouslyUser.mockResolvedValue(undefined);
  });

  it("renders a labeled email field and emulator quick access", () => {
    render(
      <AuthGate>
        <div>Signed in</div>
      </AuthGate>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QA Owner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Tester" })).toBeInTheDocument();
  });

  it("submits email-link sign-in with the typed address", async () => {
    const user = userEvent.setup();

    render(
      <AuthGate>
        <div>Signed in</div>
      </AuthGate>
    );

    await user.type(screen.getByLabelText(/email address/i), "qa@example.com");
    await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));

    await waitFor(() => {
      expect(firebaseAuthMocks.sendEmailLink).toHaveBeenCalledWith("qa@example.com", "/");
    });
  });

  it("uses the seeded emulator QA account buttons", async () => {
    const user = userEvent.setup();

    render(
      <AuthGate>
        <div>Signed in</div>
      </AuthGate>
    );

    await user.click(screen.getByRole("button", { name: "QA Admin" }));

    await waitFor(() => {
      expect(firebaseAuthMocks.signInWithEmailPassword).toHaveBeenCalledWith("qa-admin@example.com", EMULATOR_QA_PASSWORD);
    });
  });
});

// components/auth/sign-in-wall.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

interface SignInWallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInWall({ open, onOpenChange }: SignInWallProps) {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      onOpenChange(false);
    } catch (err) {
      console.error("Google sign-in failed:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            You've used your 3 free messages. Sign in for unlimited access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Button className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/");
            }}
          >
            Sign in with Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

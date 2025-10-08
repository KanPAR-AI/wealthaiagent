import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { LoginForm } from "@/components/auth/login-form"
import { useJwtToken } from "@/hooks/use-jwt-token"
import { hasValidStoredToken } from "@/utils/jwt-storage"

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, isLoadingToken } = useJwtToken()

  useEffect(() => {
    // Check if we have a valid token in local storage or in the store
    if (hasValidStoredToken() || token) {
      // Redirect to chat page immediately
      navigate("/chat")
    }
  }, [token, navigate])

  // Show loading state while checking for token
  if (isLoadingToken || hasValidStoredToken() || token) {
    return (
      <div className="bg-background flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="w-full max-w-sm text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}

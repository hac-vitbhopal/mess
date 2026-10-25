import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export type OperatorClaims = { role?: string; messId?: string; operatorId?: string };

type OperatorAuthState = { ready: boolean; claims: OperatorClaims | null };

/**
 * Firebase restores a saved sign-in asynchronously after a page load.
 * `ready` becomes true only once Firebase has answered, so Firestore queries
 * should wait for it. `claims` holds the role/messId set by the login server.
 */
export function useOperatorAuth(): OperatorAuthState {
  const [state, setState] = useState<OperatorAuthState>({ ready: false, claims: null });

  useEffect(() => {
    if (!auth) {
      setState({ ready: true, claims: null });
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ready: true, claims: null });
        return;
      }
      try {
        const result = await user.getIdTokenResult();
        setState({
          ready: true,
          claims: {
            role: typeof result.claims.role === "string" ? result.claims.role : undefined,
            messId: typeof result.claims.messId === "string" ? result.claims.messId : undefined,
            operatorId: typeof result.claims.operatorId === "string" ? result.claims.operatorId : undefined,
          },
        });
      } catch {
        setState({ ready: true, claims: null });
      }
    });
  }, []);

  return state;
}

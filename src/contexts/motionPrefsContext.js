import { createContext, useContext } from "react";

export const MotionPrefsContext = createContext({
  mode: "auto",
  reduced: false,
  sysReduced: false,
  cycle: () => {},
});

export const useMotionPrefs = () => useContext(MotionPrefsContext);

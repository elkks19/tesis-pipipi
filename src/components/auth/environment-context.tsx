"use client";
import { createContext, useContext } from "react";
const Context = createContext(false);
export function EnvironmentProvider({ raspberry, children }: { raspberry: boolean; children: React.ReactNode }) {
  return <Context.Provider value={raspberry}>{children}</Context.Provider>;
}
export function useRaspberryEnvironment() { return useContext(Context); }

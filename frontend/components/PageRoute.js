"use client";

import { createContext, useContext } from "react";

// Where the visitor is (path, address parameters like the product, query): a block of a plugin that sits on a page needs it to know what to show.
const PageRouteContext = createContext(null);
export const PageRouteProvider = ({ value, children }) => <PageRouteContext.Provider value={value}>{children}</PageRouteContext.Provider>;
export const usePageRoute = () => useContext(PageRouteContext);

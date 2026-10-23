// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createContext, useContext } from "react";

// Where the visitor is (path, address parameters like the product, query): a block of a plugin that sits on a page needs it to know what to show.
const PageRouteContext = createContext(null);
export const PageRouteProvider = ({ value, children }) => <PageRouteContext.Provider value={value}>{children}</PageRouteContext.Provider>;
export const usePageRoute = () => useContext(PageRouteContext);

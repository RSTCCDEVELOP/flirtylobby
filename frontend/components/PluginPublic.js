// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import PluginFrame from "./PluginFrame";

// A plugin page inside the website (header and footer of the site stay): the frame without its own border.
export default function PluginPublic({ name, file, title, route }) {
  return <PluginFrame name={name} file={file} title={title} route={route} bare />;
}

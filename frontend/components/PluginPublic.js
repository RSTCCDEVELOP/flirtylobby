"use client";

import PluginFrame from "./PluginFrame";

// A plugin page inside the website (header and footer of the site stay): the frame without its own border.
export default function PluginPublic({ name, file, title, route }) {
  return <PluginFrame name={name} file={file} title={title} route={route} bare />;
}

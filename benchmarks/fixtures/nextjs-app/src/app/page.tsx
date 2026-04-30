"use client"

import { useState } from "react"
import { Navbar, UserList, UploadForm } from "@/components"

export default function HomePage() {
  const [page, setPage] = useState<"home" | "users" | "upload">("home")

  return (
    <main>
      <Navbar />
      <div className="container">
        {page === "home" && (
          <div>
            <h1>Welcome to Next.js App</h1>
            <p>This is a benchmark fixture for Context Signals MCP.</p>
            <div className="nav-buttons">
              <button onClick={() => setPage("users")}>Users</button>
              <button onClick={() => setPage("upload")}>Upload</button>
            </div>
          </div>
        )}
        {page === "users" && <UserList />}
        {page === "upload" && <UploadForm />}
      </div>
    </main>
  );
}
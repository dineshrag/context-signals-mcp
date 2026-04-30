"use client"

import { useState } from "react"

export function UserList() {
  const [users, setUsers] = useState<any[]>([])

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  )
}
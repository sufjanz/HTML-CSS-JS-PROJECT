const express = require("express")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const session = require("express-session")
const app = express()
const port = 3000

app.use(express.json())
app.use(express.static("public"))

// Session configuration
app.use(
  session({
    secret: "budget-app-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  }),
)

// File paths
const usersFile = path.join(__dirname, "users.json")
const userDataDir = path.join(__dirname, "user-data")

// Create user data directory if it doesn't exist
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir)
}

// Helper functions
function readUsers() {
  try {
    if (fs.existsSync(usersFile)) {
      const data = fs.readFileSync(usersFile, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error reading users:", error)
  }
  return []
}

function writeUsers(users) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
    return true
  } catch (error) {
    console.error("Error writing users:", error)
    return false
  }
}

function getUserDataFile(userId, type) {
  return path.join(userDataDir, `${userId}-${type}.json`)
}

function readUserData(userId, type) {
  try {
    const filePath = getUserDataFile(userId, type)
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error(`Error reading user ${type}:`, error)
  }

  // Return default data based on type
  if (type === "budget") {
    return { budget: 1000 }
  } else if (type === "tasks") {
    return []
  }
  return {}
}

function writeUserData(userId, type, data) {
  try {
    const filePath = getUserDataFile(userId, type)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error(`Error writing user ${type}:`, error)
    return false
  }
}

// Hash password function
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex")
}

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not authenticated" })
  }
  next()
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ success: false, message: "Admin access required" })
  }
  next()
}

// Account endpoints
app.post("/signup", (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" })
  }

  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address" })
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" })
  }

  const users = readUsers()

  // Check if email already exists
  const existingUser = users.find((user) => user.email === email)
  if (existingUser) {
    return res.status(400).json({ success: false, message: "Email already exists" })
  }

  // Create new user
  const newUser = {
    id: Date.now().toString(),
    email: email,
    password: hashPassword(password),
    isAdmin: email === "admin@budget.com", // Make admin@budget.com the admin
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)

  // Create initial user data
  writeUserData(newUser.id, "budget", { budget: 1000 })
  writeUserData(newUser.id, "tasks", [])

  if (writeUsers(users)) {
    res.json({ success: true, message: "Account created successfully" })
  } else {
    res.status(500).json({ success: false, message: "Failed to create account" })
  }
})

app.post("/login", (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" })
  }

  const users = readUsers()
  const hashedPassword = hashPassword(password)

  const user = users.find((u) => u.email === email && u.password === hashedPassword)

  if (user) {
    req.session.userId = user.id
    req.session.userEmail = user.email
    req.session.isAdmin = user.isAdmin

    res.json({
      success: true,
      message: "Login successful",
      userId: user.id,
      isAdmin: user.isAdmin,
    })
  } else {
    res.status(401).json({ success: false, message: "Invalid email or password" })
  }
})

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to logout" })
    }
    res.json({ success: true, message: "Logged out successfully" })
  })
})

// Check session endpoint
app.get("/check-session", (req, res) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true,
      userId: req.session.userId,
      email: req.session.userEmail,
      isAdmin: req.session.isAdmin,
    })
  } else {
    res.json({ loggedIn: false })
  }
})

// Budget endpoints (user-specific)
app.get("/get-budget", requireAuth, (req, res) => {
  const budgetData = readUserData(req.session.userId, "budget")
  res.json(budgetData)
})

app.post("/update-budget", requireAuth, (req, res) => {
  const { budget } = req.body

  if (typeof budget !== "number") {
    return res.status(400).json({ error: "Budget must be a number" })
  }

  const budgetData = { budget: budget }

  if (writeUserData(req.session.userId, "budget", budgetData)) {
    res.json({ success: true, budget: budget })
  } else {
    res.status(500).json({ error: "Failed to update budget" })
  }
})

// Task endpoints (user-specific)
app.get("/get-tasks", requireAuth, (req, res) => {
  const tasks = readUserData(req.session.userId, "tasks")
  res.json({ tasks })
})

app.post("/save-task", requireAuth, (req, res) => {
  const { name, price } = req.body

  if (!name || typeof price !== "number") {
    return res.status(400).json({ error: "Name and price are required" })
  }

  const tasks = readUserData(req.session.userId, "tasks")

  const newTask = {
    id: Date.now().toString(),
    name: name,
    price: price,
    createdAt: new Date().toISOString(),
  }

  tasks.push(newTask)

  if (writeUserData(req.session.userId, "tasks", tasks)) {
    res.json({ success: true, task: newTask })
  } else {
    res.status(500).json({ error: "Failed to save task" })
  }
})

app.delete("/delete-task/:id", requireAuth, (req, res) => {
  const taskId = req.params.id
  const tasks = readUserData(req.session.userId, "tasks")
  const taskIndex = tasks.findIndex((task) => task.id === taskId)

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" })
  }

  tasks.splice(taskIndex, 1)

  if (writeUserData(req.session.userId, "tasks", tasks)) {
    res.json({ success: true })
  } else {
    res.status(500).json({ error: "Failed to delete task" })
  }
})

// Admin endpoints
app.get("/admin/users", requireAdmin, (req, res) => {
  const users = readUsers()
  const usersWithData = users.map((user) => {
    const budget = readUserData(user.id, "budget")
    const tasks = readUserData(user.id, "tasks")
    return {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      budget: budget.budget,
      taskCount: tasks.length,
      totalSpent: tasks.reduce((sum, task) => sum + task.price, 0),
    }
  })
  res.json({ users: usersWithData })
})

app.get("/admin/user/:id", requireAdmin, (req, res) => {
  const userId = req.params.id
  const users = readUsers()
  const user = users.find((u) => u.id === userId)

  if (!user) {
    return res.status(404).json({ error: "User not found" })
  }

  const budget = readUserData(userId, "budget")
  const tasks = readUserData(userId, "tasks")

  res.json({
    user: {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    },
    budget: budget,
    tasks: tasks,
  })
})

app.post("/admin/user/:id/budget", requireAdmin, (req, res) => {
  const userId = req.params.id
  const { budget } = req.body

  if (typeof budget !== "number") {
    return res.status(400).json({ error: "Budget must be a number" })
  }

  const budgetData = { budget: budget }

  if (writeUserData(userId, "budget", budgetData)) {
    res.json({ success: true, budget: budget })
  } else {
    res.status(500).json({ error: "Failed to update user budget" })
  }
})

app.delete("/admin/user/:id", requireAdmin, (req, res) => {
  const userId = req.params.id
  const users = readUsers()
  const userIndex = users.findIndex((u) => u.id === userId)

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" })
  }

  // Don't allow deleting admin users
  if (users[userIndex].isAdmin) {
    return res.status(400).json({ error: "Cannot delete admin user" })
  }

  // Remove user
  users.splice(userIndex, 1)

  // Delete user data files
  try {
    const budgetFile = getUserDataFile(userId, "budget")
    const tasksFile = getUserDataFile(userId, "tasks")

    if (fs.existsSync(budgetFile)) fs.unlinkSync(budgetFile)
    if (fs.existsSync(tasksFile)) fs.unlinkSync(tasksFile)
  } catch (error) {
    console.error("Error deleting user files:", error)
  }

  if (writeUsers(users)) {
    res.json({ success: true })
  } else {
    res.status(500).json({ error: "Failed to delete user" })
  }
})

// Serve HTML files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "homepage.html"))
})

app.get("/createmenu.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "createmenu.html"))
})

app.get("/budget.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "budget.html"))
})

app.get("/accounts.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "accounts.html"))
})

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"))
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)

  // Create initial files if they don't exist
  if (!fs.existsSync(usersFile)) {
    writeUsers([])
  }
})

const express = require("express")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const session = require("express-session")
const multer = require("multer")
const app = express()
const port = 3000

// IMPORTANT: Increase JSON payload limit for base64 images
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))
app.use(express.static("public"))

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, "public", "uploads")
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, req.session.userId + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed!"), false)
    }
  },
})

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
    console.log("Writing", users.length, "users to file:", usersFile)
    const jsonData = JSON.stringify(users, null, 2)
    console.log("JSON data length:", jsonData.length, "characters")

    fs.writeFileSync(usersFile, jsonData)
    console.log("✅ Users file written successfully")
    return true
  } catch (error) {
    console.error("❌ Error writing users file:", error)
    console.error("Error details:", {
      code: error.code,
      errno: error.errno,
      path: error.path,
    })
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
    return { budget: 0 }
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
  const { email, password, firstName, lastName } = req.body

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      success: false,
      message: "Email, password, first name, and last name are required",
    })
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
    firstName: firstName,
    lastName: lastName,
    avatar: null,
    isAdmin: email === "admin@budget.com", // Make admin@budget.com the admin
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)

  // Create initial user data with 0 budget
  writeUserData(newUser.id, "budget", { budget: 0 })
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
      firstName: user.firstName,
      lastName: user.lastName,
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
    const users = readUsers()
    const user = users.find((u) => u.id === req.session.userId)

    if (user) {
      res.json({
        loggedIn: true,
        userId: req.session.userId,
        email: req.session.userEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isAdmin: req.session.isAdmin,
      })
    } else {
      res.json({ loggedIn: false })
    }
  } else {
    res.json({ loggedIn: false })
  }
})

// NEW: Save avatar as base64 data directly to user account
app.post("/save-avatar", requireAuth, (req, res) => {
  console.log("=== AVATAR SAVE REQUEST ===")
  console.log("User ID:", req.session.userId)
  console.log("Request body keys:", Object.keys(req.body))

  const { avatar } = req.body

  if (!avatar) {
    console.log("❌ No avatar data provided")
    return res.status(400).json({ success: false, message: "No avatar data provided" })
  }

  console.log("Avatar data length:", avatar.length)
  console.log("Avatar starts with:", avatar.substring(0, 50))

  // More flexible validation for base64 images
  if (!avatar.startsWith("data:image/")) {
    console.log("❌ Invalid image format - doesn't start with data:image/")
    return res.status(400).json({ success: false, message: "Invalid image format. Please select a valid image file." })
  }

  try {
    // Check if the base64 string is too large (limit to ~5MB when encoded)
    if (avatar.length > 7000000) {
      console.log("❌ Image too large:", avatar.length, "characters")
      return res.status(400).json({ success: false, message: "Image too large. Please use a smaller image (max 5MB)." })
    }

    console.log("📖 Reading users file...")
    const users = readUsers()
    console.log("Users loaded:", users.length, "users found")

    const userIndex = users.findIndex((u) => u.id === req.session.userId)

    if (userIndex === -1) {
      console.log("❌ User not found in database:", req.session.userId)
      return res.status(404).json({ success: false, message: "User account not found" })
    }

    console.log("✅ User found:", users[userIndex].email)
    console.log("💾 Updating avatar for user...")

    // Update user with new avatar
    users[userIndex].avatar = avatar
    users[userIndex].avatarUpdated = new Date().toISOString()

    console.log("💿 Writing users file...")
    const writeSuccess = writeUsers(users)

    if (writeSuccess) {
      console.log("✅ Avatar saved successfully for user", req.session.userId)
      res.json({
        success: true,
        message: "Avatar saved successfully",
        avatarLength: avatar.length,
      })
    } else {
      console.error("❌ Failed to write users file")
      res.status(500).json({ success: false, message: "Failed to save avatar to database. Please try again." })
    }
  } catch (error) {
    console.error("❌ Error saving avatar:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      success: false,
      message: "Server error while saving avatar: " + error.message,
    })
  }
})

// Avatar upload endpoint (existing file upload method)
app.post("/upload-avatar", requireAuth, upload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" })
  }

  const users = readUsers()
  const userIndex = users.findIndex((u) => u.id === req.session.userId)

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" })
  }

  // Delete old avatar if exists and it's a file path (not base64)
  if (users[userIndex].avatar && users[userIndex].avatar.startsWith("/uploads/")) {
    const oldAvatarPath = path.join(__dirname, "public", users[userIndex].avatar)
    if (fs.existsSync(oldAvatarPath)) {
      fs.unlinkSync(oldAvatarPath)
    }
  }

  // Update user with new avatar path
  users[userIndex].avatar = `/uploads/${req.file.filename}`

  if (writeUsers(users)) {
    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      avatar: users[userIndex].avatar,
    })
  } else {
    res.status(500).json({ success: false, message: "Failed to save avatar" })
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

  // Just store the current budget amount
  const budgetData = { budget: budget }

  if (writeUserData(req.session.userId, "budget", budgetData)) {
    res.json({ success: true, budget: budget })
  } else {
    res.status(500).json({ error: "Failed to update budget" })
  }
})

// Save budget endpoint (same as update-budget)
app.post("/save-budget", requireAuth, (req, res) => {
  const { budget } = req.body

  if (typeof budget !== "number") {
    return res.status(400).json({ error: "Budget must be a number" })
  }

  const budgetData = { budget: budget }

  if (writeUserData(req.session.userId, "budget", budgetData)) {
    res.json({ success: true, budget: budget })
  } else {
    res.status(500).json({ error: "Failed to save budget" })
  }
})

// Reset budget to 0
app.post("/reset-budget", requireAuth, (req, res) => {
  const budgetData = { budget: 0 }

  if (writeUserData(req.session.userId, "budget", budgetData)) {
    res.json({ success: true, budget: 0 })
  } else {
    res.status(500).json({ error: "Failed to reset budget" })
  }
})

// Task endpoints (user-specific)
app.get("/get-tasks", requireAuth, (req, res) => {
  const tasks = readUserData(req.session.userId, "tasks")
  res.json({ tasks })
})

// Get items from file endpoint (for homepage compatibility)
app.get("/get-items-from-file", requireAuth, (req, res) => {
  const tasks = readUserData(req.session.userId, "tasks")
  res.json({ items: tasks })
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

// Update task endpoint
app.put("/update-task/:id", requireAuth, (req, res) => {
  const taskId = req.params.id
  const { name, price } = req.body

  if (!name || typeof price !== "number") {
    return res.status(400).json({ error: "Name and price are required" })
  }

  const tasks = readUserData(req.session.userId, "tasks")
  const taskIndex = tasks.findIndex((task) => task.id === taskId)

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" })
  }

  // Update the task
  tasks[taskIndex] = {
    ...tasks[taskIndex],
    name: name,
    price: price,
    updatedAt: new Date().toISOString(),
  }

  if (writeUserData(req.session.userId, "tasks", tasks)) {
    res.json({ success: true, task: tasks[taskIndex] })
  } else {
    res.status(500).json({ error: "Failed to update task" })
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
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      budget: budget.budget,
      taskCount: tasks.length,
      totalSpent: tasks.reduce((sum, task) => sum + task.price, 0),
    }
  })
  res.json({ users: usersWithData })
})

// Admin update user budget
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

// Admin delete user
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

    // Delete user avatar if exists and it's a file path (not base64)
    const user = users[userIndex]
    if (user && user.avatar && user.avatar.startsWith("/uploads/")) {
      const avatarPath = path.join(__dirname, "public", user.avatar)
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath)
      }
    }
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

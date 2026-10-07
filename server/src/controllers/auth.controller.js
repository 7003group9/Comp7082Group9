import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.endsWith('@my.bcit.ca')) {
      return res.status(400).json({
        error: 'A valid BCIT email is required'
      });
    }

    const result = await query(
      `SELECT id, school_email, student_id, password_hash, role
       FROM users
       WHERE school_email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({
        error: 'This account does not have a password'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    return res.json({
      user: {
        id: user.id,
        school_email: user.school_email,
        student_id: user.student_id,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'Login failed'
    });
  }
};


export const register = async (req, res) => {
  try {
    const { email, studentId, password } = req.body;

    if (!email || !studentId || !password) {
      return res.status(400).json({
        error: 'Email, student ID, and password are required'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanStudentId = studentId.trim().toUpperCase();

    if (!cleanEmail.endsWith('@my.bcit.ca')) {
      return res.status(400).json({
        error: 'A valid BCIT email is required'
      });
    }

    if (!/^A0\d{7}$/.test(cleanStudentId)) {
      return res.status(400).json({
        error: 'A valid BCIT student ID is required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    const existingUser = await query(
      `SELECT id FROM users
       WHERE school_email = $1 OR student_id = $2`,
      [cleanEmail, cleanStudentId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with that email or student ID already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (school_email, student_id, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, school_email, student_id, role`,
      [cleanEmail, cleanStudentId, passwordHash]
    );

    return res.status(201).json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);

    return res.status(500).json({
      error: 'Could not create account'
    });
  }
};
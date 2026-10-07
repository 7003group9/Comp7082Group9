-- Creates the User table and types
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    user_type VARCHAR(50) DEFAULT 'student',
    is_suspended BOOLEAN DEFAULT FALSE
);

-- Creates the items table
CREATE TABLE Items (
    item_id SERIAL PRIMARY KEY,
    finder_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    location VARCHAR(255),
    photos JSONB, 
    status VARCHAR(50) DEFAULT 'unclaimed',
    is_draft BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (finder_id) REFERENCES Users(user_id)
);

-- Creates the Claims Table
CREATE TABLE Claims (
    claim_id SERIAL PRIMARY KEY,
    item_id INT NOT NULL,
    claimant_id INT NOT NULL,
    submitted_answers TEXT NOT NULL,
    wrong_attempts INT DEFAULT 0,
    claim_status VARCHAR(50) DEFAULT 'pending',
    FOREIGN KEY (item_id) REFERENCES Items(item_id),
    FOREIGN KEY (claimant_id) REFERENCES Users(user_id)
);
-- T4L Platform - Database Schema
-- PostgreSQL / Supabase
-- This file contains the complete database schema for the T4L platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert default activities
INSERT INTO activities (name, type, points, requires_proof) VALUES
  ('Watch Podcast', 'podcast_watch', 1000, false),
  ('Complete Podcast Workbook', 'podcast_workbook', 1000, true),
  ('Attend Webinar', 'webinar_attend', 2000, false);

-- Insert default journeys
INSERT INTO journeys (name, type, duration_weeks, total_points_target, weekly_points_target, is_premium) VALUES
  ('Curious Cat Path', 'free', 0, 0, 0, false),
  ('4-Week Intro Journey', 'intro_4_week', 4, 10000, 2500, true);

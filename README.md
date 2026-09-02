# PRC Roll Call

School Morning Attendance Website

Build a simple, clean, and responsive web application for recording student morning attendance.

The website should be easy for teachers to use and should avoid unnecessary features or complexity.

Tech Stack

React

TypeScript

Tailwind CSS

Supabase (Database + Admin Authentication)



Pages

There are only 3 pages.

1. Attendance Form

This page is public.

Purpose: Teachers submit attendance for one classroom each morning.

Form Fields

Classroom (Dropdown)

Students arrived before 07:20

Students arrived between 07:20–08:20

Submit button

Requirements

Do not ask users to select the date.

Automatically use the current date when the form is submitted.

Only allow one submission per classroom per day.

If today’s record already exists, update it instead of creating a duplicate.

Validate that all numbers are non-negative integers.

Show a simple success message after submission.

Keep this page minimal and mobile-friendly.



2. Leaderboard / Dashboard

This page is public.

Display attendance statistics for all classrooms.

Summary Cards

Total classrooms submitted today

Total students who arrived before 07:20

Total students who arrived between 07:20–08:20

Overall on-time percentage

Leaderboard Table

Columns

Rank

Classroom

Before 07:20

Between 07:20–08:20

Total

On-time %

Rank classrooms by the highest on-time percentage.

Time Filters

Today

Weekly

Monthly

All Time

Weekly, Monthly, and All Time should calculate the average on-time percentage for each classroom.

Add one simple bar chart comparing classroom on-time percentages.

Keep the dashboard clean and easy to read.



3. Admin

Admin login required.

Only admins can access this page.

Admin can:

Add classroom

Edit classroom

Delete classroom

Enable or disable classroom

The classroom dropdown on the attendance form should automatically reflect these changes.



Database

Classrooms

id

classroom_name

total_students

active

created_at

Attendance

id

classroom_id

attendance_date

on_time_count

late_count

created_at

Only one attendance record per classroom per date.



Calculations

Total Present

= on_time_count + late_count

On-time Percentage

= on_time_count ÷ total_students × 100

Use total_students from the classroom table.



Design

Keep the interface simple and modern.

Use:

White background

Blue accent color

Rounded cards

Clean tables

Responsive layout

Large buttons for mobile

Minimal animations

Avoid unnecessary pages, settings, or advanced features.

The application should be fast, intuitive, and suitable for everyday use by school staff.

Generate the complete application, including the Supabase database schema and seed data for 11 classrooms.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/509a3a95-30bf-417e-8558-0d51d138a892).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

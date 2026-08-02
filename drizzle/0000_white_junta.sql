CREATE TABLE `daily_puzzles` (
	`id` text PRIMARY KEY NOT NULL,
	`date_key` text NOT NULL,
	`puzzle_number` integer NOT NULL,
	`song_id` text NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `music_songs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_puzzles_date_key_unique` ON `daily_puzzles` (`date_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_puzzles_puzzle_number_unique` ON `daily_puzzles` (`puzzle_number`);--> statement-breakpoint
CREATE TABLE `music_import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`stage` text DEFAULT 'PREPARING' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`failure_reason` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `music_songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `music_songs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_song_id` text NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`artist_id` text,
	`album` text,
	`genre` text,
	`release_year` integer,
	`duration` integer NOT NULL,
	`license` text NOT NULL,
	`license_url` text NOT NULL,
	`artwork_url` text,
	`source_url` text NOT NULL,
	`clip_start_seconds` real DEFAULT 0 NOT NULL,
	`storage_folder` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`failure_reason` text,
	`provider_response` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_provider_song_unique` ON `music_songs` (`provider`,`provider_song_id`);
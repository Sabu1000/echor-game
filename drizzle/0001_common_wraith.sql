CREATE TABLE `daily_game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`anonymous_token_hash` text NOT NULL,
	`puzzle_id` text NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`current_attempt` integer DEFAULT 0 NOT NULL,
	`attempts_json` text DEFAULT '[]' NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`puzzle_id`) REFERENCES `daily_puzzles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_session_token_puzzle_unique` ON `daily_game_sessions` (`anonymous_token_hash`,`puzzle_id`);--> statement-breakpoint
CREATE TABLE `game_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`game_session_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`game_session_id`) REFERENCES `daily_game_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_mutation_session_key_unique` ON `game_mutations` (`game_session_id`,`idempotency_key`);
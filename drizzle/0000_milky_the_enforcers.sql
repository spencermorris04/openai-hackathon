CREATE TABLE `openai-hackathon_agent_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feedback_id` integer,
	`agent_type` text NOT NULL,
	`execution_id` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`error` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`feedback_id`) REFERENCES `openai-hackathon_feedback_submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feedback_agent_idx` ON `openai-hackathon_agent_executions` (`feedback_id`,`agent_type`);--> statement-breakpoint
CREATE INDEX `execution_status_idx` ON `openai-hackathon_agent_executions` (`status`);--> statement-breakpoint
CREATE INDEX `started_at_idx` ON `openai-hackathon_agent_executions` (`started_at`);--> statement-breakpoint
CREATE TABLE `openai-hackathon_feedback_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`tos_agent_result` text,
	`actionability_agent_result` text,
	`tone_agent_result` text,
	`coordinator_result` text,
	`final_verdict` text,
	`suggestions` text,
	`human_review_status` text,
	`human_reviewer_id` text,
	`human_review_notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `status_idx` ON `openai-hackathon_feedback_submissions` (`status`);--> statement-breakpoint
CREATE INDEX `final_verdict_idx` ON `openai-hackathon_feedback_submissions` (`final_verdict`);--> statement-breakpoint
CREATE INDEX `human_review_idx` ON `openai-hackathon_feedback_submissions` (`human_review_status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `openai-hackathon_feedback_submissions` (`created_at`);--> statement-breakpoint
CREATE TABLE `openai-hackathon_post` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `name_idx` ON `openai-hackathon_post` (`name`);
CREATE TABLE "hello_world" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hello_world_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"message" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

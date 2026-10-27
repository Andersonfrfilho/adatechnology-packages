ALTER TABLE "notification"."deliveries" ADD COLUMN IF NOT EXISTS "device_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification"."deliveries" ADD CONSTRAINT "deliveries_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "notification"."devices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

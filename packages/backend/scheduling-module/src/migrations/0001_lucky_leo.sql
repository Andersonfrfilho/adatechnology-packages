-- Os únicos compostos vêm antes das FKs que os referenciam: o Postgres exige a unicidade já
-- existente em `(id, company_id)` para aceitar a chave estrangeira composta.
CREATE UNIQUE INDEX "idx_resources_id_company" ON "scheduling"."resources" USING btree ("id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_services_id_company" ON "scheduling"."services" USING btree ("id","company_id");--> statement-breakpoint
ALTER TABLE "scheduling"."resource_services" ADD CONSTRAINT "resource_services_resource_company_fk" FOREIGN KEY ("resource_id","company_id") REFERENCES "scheduling"."resources"("id","company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling"."resource_services" ADD CONSTRAINT "resource_services_service_company_fk" FOREIGN KEY ("service_id","company_id") REFERENCES "scheduling"."services"("id","company_id") ON DELETE cascade ON UPDATE no action;

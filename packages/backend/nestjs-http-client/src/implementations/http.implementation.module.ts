import { Module } from "@nestjs/common";

import { HttpImplementationAxiosModule } from "./axios/axios.http.module";

@Module({
  imports: [HttpImplementationAxiosModule],
  exports: [HttpImplementationAxiosModule],
})
export class HttpImplementationModule {}

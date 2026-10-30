import { DockerTestSandbox } from "./docker-sandbox.js";
/** Configuration comes only from the trusted host, never from a tool payload. */
export function configuredTestSandbox(): DockerTestSandbox | undefined {
  const image = process.env["DEVGUARDIAN_SANDBOX_IMAGE_ID"];
  if (!image) return undefined;
  return new DockerTestSandbox(process.env["DEVGUARDIAN_DOCKER_BINARY"] ?? "docker", image);
}

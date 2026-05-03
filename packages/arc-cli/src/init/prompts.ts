import { isCancel, password, text } from "@clack/prompts";
import type { ArcConfig } from "@euglowlabs/arc-shared";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSlug(value: string | undefined): string | undefined {
  if (!value) return "Cannot be empty";
  return SLUG_REGEX.test(value) ? undefined : "Must be a lowercase slug (a-z, 0-9, -)";
}

function validateDomain(value: string | undefined): string | undefined {
  if (!value) return "Cannot be empty";
  return DOMAIN_REGEX.test(value) ? undefined : "Must be a valid hostname";
}

function validateEmail(value: string | undefined): string | undefined {
  if (!value) return "Cannot be empty";
  return EMAIL_REGEX.test(value) ? undefined : "Must be a valid email address";
}

function validateNonEmpty(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? undefined : "Cannot be empty";
}

/**
 * Run the interactive prompts for `arc init`.
 *
 * Single-machine install model (ADR-0012): no `target` switch, no
 * provisioning questions. We assume the user runs `arc init` on the
 * machine that will host the stack. Downstream zod defaults take
 * care of `agent`, `stack`, `backups`, `services`, `projects`.
 */
export async function promptForConfig(): Promise<Partial<ArcConfig> | null> {
  const project = await text({
    message: "Project slug",
    placeholder: "johann-stack",
    validate: validateSlug,
  });
  if (isCancel(project)) return null;

  const domain = await text({
    message: "Domain",
    placeholder: "mondomaine.dev",
    validate: validateDomain,
  });
  if (isCancel(domain)) return null;

  const email = await text({
    message: "Admin email",
    placeholder: "you@mondomaine.dev",
    validate: validateEmail,
  });
  if (isCancel(email)) return null;

  const dnsZone = await text({
    message: "Cloudflare DNS zone",
    initialValue: domain,
    validate: validateDomain,
  });
  if (isCancel(dnsZone)) return null;

  const dnsToken = await password({
    message: "Cloudflare API token",
    validate: validateNonEmpty,
  });
  if (isCancel(dnsToken)) return null;

  return {
    project,
    domain,
    email,
    dns: {
      provider: "cloudflare",
      zone: dnsZone,
      api_token: dnsToken,
    },
  };
}

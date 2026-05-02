import { isCancel, password, select, text } from "@clack/prompts";
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
 * Returns a partial `ArcConfig` ready to serialize, or `null` if the
 * user cancelled (Ctrl+C / clack cancel symbol). The returned shape only
 * fills the fields covered by the prompts; downstream zod defaults take
 * care of `stack`, `backups`, `services`, `projects`.
 */
export async function promptForConfig(): Promise<Partial<ArcConfig> | null> {
  const project = await text({
    message: "Project slug",
    placeholder: "johann-stack",
    validate: validateSlug,
  });
  if (isCancel(project)) return null;

  const target = await select({
    message: "Where do you want to deploy?",
    options: [
      { value: "local" as const, label: "Local (WSL2 / macOS / Linux)" },
      { value: "vps" as const, label: "VPS (Hetzner)" },
    ],
  });
  if (isCancel(target)) return null;

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

  const draft: Partial<ArcConfig> = {
    project,
    target,
    domain,
    email,
    dns: {
      provider: "cloudflare",
      zone: dnsZone,
      api_token: dnsToken,
      tunnel: target === "local",
    },
  };

  if (target === "vps") {
    const plan = await text({
      message: "Hetzner plan",
      initialValue: "cx32",
      validate: validateNonEmpty,
    });
    if (isCancel(plan)) return null;

    const location = await text({
      message: "Hetzner location",
      initialValue: "fsn1",
      validate: validateNonEmpty,
    });
    if (isCancel(location)) return null;

    const sshKey = await text({
      message: "Path to SSH public key",
      initialValue: "~/.ssh/id_ed25519.pub",
      validate: validateNonEmpty,
    });
    if (isCancel(sshKey)) return null;

    draft.provider = {
      name: "hetzner",
      plan,
      location,
      ssh_key: sshKey,
    };
  }

  return draft;
}

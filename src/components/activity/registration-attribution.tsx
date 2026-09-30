import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { registrationRoleLabel, type RegistrationAuthor } from "@/lib/registration-author";

export function RegistrationAttribution({ author, label = "Registrado por" }: {
  author?: RegistrationAuthor;
  label?: string;
}) {
  const initials = author?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar aria-hidden="true"><AvatarFallback>{initials || "—"}</AvatarFallback></Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          {author?.role ? <Badge variant="secondary">{registrationRoleLabel(author.role)}</Badge> : null}
        </div>
        <p className="break-words text-sm font-medium leading-snug">{author?.name || "Responsable no registrado"}</p>
        {author?.email ? <p className="break-all text-xs text-muted-foreground">{author.email}</p> : null}
      </div>
    </div>
  );
}

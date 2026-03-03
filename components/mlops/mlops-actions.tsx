"use client";

import { MlopsJobType, MlopsModelStage, OrganizationRole, WorkspacePersona } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

function statusClass(status: "idle" | "success" | "error") {
  if (status === "success") {
    return "text-emerald-700";
  }

  if (status === "error") {
    return "text-rose-700";
  }

  return "text-slate-600";
}

type Feedback = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialFeedback: Feedback = {
  status: "idle",
  message: "",
};

export function CreateProjectForm({ organizationSlug }: { organizationSlug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFeedback({ status: "error", message: "Project name is required." });
      return;
    }

    setSaving(true);
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          name,
          description: description || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setFeedback({ status: "error", message: payload.error ?? "Failed to create project." });
        return;
      }

      setName("");
      setDescription("");
      setFeedback({ status: "success", message: "Project created." });
      router.refresh();
    } catch {
      setFeedback({ status: "error", message: "Network error while creating project." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Create Project</h3>
      <label className="block text-sm font-medium text-slate-700">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Customer churn scoring"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="focus-ring mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="What this project does and why it matters."
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create project"}
      </button>
      {feedback.message ? <p className={`text-sm ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
    </form>
  );
}

export function QueueJobForm({
  organizationSlug,
  projects,
}: {
  organizationSlug: string;
  projects: Array<{ id: string; name: string; slug: string }>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("Batch training job");
  const [type, setType] = useState<MlopsJobType>(MlopsJobType.TRAIN);
  const [containerImage, setContainerImage] = useState("python:3.11-slim");
  const [command, setCommand] = useState("python train.py");
  const [inputs, setInputs] = useState('{"dataset":"s3://customer-bucket/train.csv"}');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectId) {
      setFeedback({ status: "error", message: "Select a project first." });
      return;
    }

    let parsedInputs: Record<string, unknown> | undefined;
    if (inputs.trim()) {
      try {
        parsedInputs = JSON.parse(inputs) as Record<string, unknown>;
      } catch {
        setFeedback({ status: "error", message: "Inputs must be valid JSON." });
        return;
      }
    }

    setSaving(true);
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          projectId,
          name,
          type,
          containerImage,
          command: command
            .split(" ")
            .map((part) => part.trim())
            .filter(Boolean),
          inputs: parsedInputs,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ status: "error", message: payload.error ?? "Failed to queue job." });
        return;
      }

      setFeedback({ status: "success", message: "Job queued. Runner can pick it up now." });
      router.refresh();
    } catch {
      setFeedback({ status: "error", message: "Network error while queuing job." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Queue Job</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Project
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Type
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MlopsJobType)}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Object.values(MlopsJobType).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Job Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Container Image
        <input
          value={containerImage}
          onChange={(event) => setContainerImage(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="ghcr.io/zokorp/model-trainer:latest"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Command
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="python train.py --config config.yml"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Inputs (JSON)
        <textarea
          value={inputs}
          onChange={(event) => setInputs(event.target.value)}
          className="focus-ring mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
        />
      </label>
      <button
        type="submit"
        disabled={saving || projects.length === 0}
        className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Queueing..." : "Queue job"}
      </button>
      {feedback.message ? <p className={`text-sm ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
    </form>
  );
}

export function CreateModelForm({
  organizationSlug,
  projects,
}: {
  organizationSlug: string;
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("fraud-risk-classifier");
  const [version, setVersion] = useState("v1.0.0");
  const [stage, setStage] = useState<MlopsModelStage>(MlopsModelStage.DEV);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectId) {
      setFeedback({ status: "error", message: "Select a project." });
      return;
    }

    setSaving(true);
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          projectId,
          name,
          initialVersion: version,
          stage,
          notes: notes || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ status: "error", message: payload.error ?? "Failed to create model." });
        return;
      }

      setFeedback({ status: "success", message: "Model registry entry created." });
      router.refresh();
    } catch {
      setFeedback({ status: "error", message: "Network error while creating model." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Add Model</h3>
      <label className="block text-sm font-medium text-slate-700">
        Project
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Model name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Initial version
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Stage
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as MlopsModelStage)}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Object.values(MlopsModelStage).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="focus-ring mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Calibration notes, data version, and caveats"
        />
      </label>
      <button
        type="submit"
        disabled={saving || projects.length === 0}
        className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Add model"}
      </button>
      {feedback.message ? <p className={`text-sm ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
    </form>
  );
}

export function CreateDeploymentForm({
  organizationSlug,
  projects,
  modelVersions,
}: {
  organizationSlug: string;
  projects: Array<{ id: string; name: string }>;
  modelVersions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [modelVersionId, setModelVersionId] = useState(modelVersions[0]?.id ?? "");
  const [name, setName] = useState("starter-batch-deployment");
  const [environment, setEnvironment] = useState("prod");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [configJson, setConfigJson] = useState('{"runner":"byo-docker","schedule":"0 */6 * * *"}');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);

  const hasOptions = useMemo(() => projects.length > 0 && modelVersions.length > 0, [projects, modelVersions]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasOptions) {
      setFeedback({ status: "error", message: "Create a project and model first." });
      return;
    }

    let parsedConfig: Record<string, unknown> | undefined;
    if (configJson.trim()) {
      try {
        parsedConfig = JSON.parse(configJson) as Record<string, unknown>;
      } catch {
        setFeedback({ status: "error", message: "Config JSON is invalid." });
        return;
      }
    }

    setSaving(true);
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          projectId,
          modelVersionId,
          name,
          environment,
          endpointUrl: endpointUrl || undefined,
          configJson: parsedConfig,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ status: "error", message: payload.error ?? "Failed to create deployment." });
        return;
      }

      setFeedback({ status: "success", message: "Deployment record created." });
      router.refresh();
    } catch {
      setFeedback({ status: "error", message: "Network error while creating deployment." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Create Deployment</h3>
      <label className="block text-sm font-medium text-slate-700">
        Project
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Model version
        <select
          value={modelVersionId}
          onChange={(event) => setModelVersionId(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {modelVersions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Deployment name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Environment
          <input
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Endpoint URL (optional)
        <input
          value={endpointUrl}
          onChange={(event) => setEndpointUrl(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="https://inference.customer-cloud.com/predict"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Config (JSON)
        <textarea
          value={configJson}
          onChange={(event) => setConfigJson(event.target.value)}
          className="focus-ring mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
        />
      </label>
      <button
        type="submit"
        disabled={saving || !hasOptions}
        className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Create deployment"}
      </button>
      {feedback.message ? <p className={`text-sm ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
    </form>
  );
}

export function MlopsBillingActions({ organizationSlug }: { organizationSlug: string }) {
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);
  const [busyAction, setBusyAction] = useState<"monthly" | "annual" | "portal" | null>(null);

  async function startCheckout(interval: "monthly" | "annual") {
    setBusyAction(interval);
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          billingInterval: interval,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        setFeedback({ status: "error", message: payload.error ?? "Unable to start checkout." });
        return;
      }

      window.location.href = payload.url;
    } catch {
      setFeedback({ status: "error", message: "Network error while starting checkout." });
    } finally {
      setBusyAction(null);
    }
  }

  async function openPortal() {
    setBusyAction("portal");
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/billing/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationSlug }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        setFeedback({ status: "error", message: payload.error ?? "Unable to open billing portal." });
        return;
      }

      window.location.href = payload.url;
    } catch {
      setFeedback({ status: "error", message: "Network error while opening portal." });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Plan Management</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startCheckout("monthly")}
          disabled={busyAction !== null}
          className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === "monthly" ? "Starting..." : "Subscribe monthly"}
        </button>
        <button
          type="button"
          onClick={() => startCheckout("annual")}
          disabled={busyAction !== null}
          className="focus-ring rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === "annual" ? "Starting..." : "Subscribe annual"}
        </button>
        <button
          type="button"
          onClick={openPortal}
          disabled={busyAction !== null}
          className="focus-ring rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === "portal" ? "Opening..." : "Manage billing"}
        </button>
      </div>
      {feedback.message ? <p className={`text-sm ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
    </div>
  );
}

export function CreateRunnerKeyForm({ organizationSlug }: { organizationSlug: string }) {
  const router = useRouter();
  const [name, setName] = useState("primary-runner");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);
  const [apiKey, setApiKey] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setFeedback(initialFeedback);
    setApiKey("");

    try {
      const response = await fetch("/api/mlops/runner/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          name,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        apiKey?: string;
      };

      if (!response.ok || !payload.apiKey) {
        setFeedback({ status: "error", message: payload.error ?? "Failed to create runner key." });
        return;
      }

      setApiKey(payload.apiKey);
      setFeedback({ status: "success", message: "Runner key created. Copy and store this now." });
      router.refresh();
    } catch {
      setFeedback({ status: "error", message: "Network error while creating runner key." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Create Runner API Key</h3>
      <label className="block text-sm font-medium text-slate-700">
        Key name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="prod-us-east-runner"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create API key"}
      </button>
      {feedback.message ? <p className={`text-sm ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
      {apiKey ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">Copy once</p>
          <pre className="mt-2 overflow-x-auto text-xs text-amber-900">{apiKey}</pre>
        </div>
      ) : null}
    </form>
  );
}

export function UpdateMemberRoleForm(props: {
  organizationSlug: string;
  membershipId: string;
  currentRole: OrganizationRole;
  currentPersona: WorkspacePersona;
  isCurrentUser: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<OrganizationRole>(props.currentRole);
  const [persona, setPersona] = useState<WorkspacePersona>(props.currentPersona);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialFeedback);

  async function onSave() {
    setSaving(true);
    setFeedback(initialFeedback);

    try {
      const response = await fetch("/api/mlops/organization/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: props.organizationSlug,
          membershipId: props.membershipId,
          role,
          workspacePersona: persona,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({ status: "error", message: payload.error ?? "Failed to update member." });
        return;
      }

      setFeedback({ status: "success", message: "Updated." });
      router.refresh();
    } catch {
      setFeedback({ status: "error", message: "Network error while updating member." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as OrganizationRole)}
          className="focus-ring rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          disabled={saving || props.isCurrentUser}
        >
          {Object.values(OrganizationRole).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={persona}
          onChange={(event) => setPersona(event.target.value as WorkspacePersona)}
          className="focus-ring rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          disabled={saving}
        >
          {Object.values(WorkspacePersona).map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="focus-ring rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {feedback.message ? <p className={`text-xs ${statusClass(feedback.status)}`}>{feedback.message}</p> : null}
    </div>
  );
}

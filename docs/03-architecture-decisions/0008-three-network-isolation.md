# ADR-0008 : Trois réseaux Docker isolés (prod / ai / sandbox)

## Statut
Accepté
Date : 2026-05-01

## Contexte
La stack ARC inclut des services hétérogènes en niveau de confiance :
- **Apps utilisateur** (Next.js, n8n) — exposés au public, doivent atteindre Postgres
- **LLMs et agents AI** (Ollama, OpenClaw, DeepAgents) — peuvent appeler des APIs externes ; reçoivent des prompts utilisateur potentiellement malicieux
- **Code Executor / sandbox** — exécute du code généré par les LLMs ; doit être considéré comme **hostile** par défaut

Si la sandbox a accès au réseau prod, un agent compromis peut exfiltrer la BDD. Si la sandbox a accès à internet, elle peut exfiltrer vers un C2 externe ou miner du crypto.

La spec infra §3 et §11.1 prescrit l'isolation par réseaux Docker.

## Décision
Trois réseaux Docker distincts, créés et maintenus par le CLI `arc` :

| Réseau | Driver | `internal` | Accès internet | Vers autres réseaux |
|---|---|---|---|---|
| `prod_net` | bridge | non | ✅ | → `ai_net` (lecture seule, via DNS interne) |
| `ai_net` | bridge | non | ✅ (APIs externes) | → `sandbox_net` (déclenchement exec) |
| `sandbox_net` | bridge | **`internal: true`** | ❌ | aucun |

Règles complémentaires (durcissement sandbox) :
- `read_only: true` sur le container code-executor
- `cap_drop: [ALL]` + `security_opt: [no-new-privileges:true]`
- `mem_limit: 512m`, `cpus: 0.5`
- timeout 30s par exécution
- Pas de partage de volume avec prod

Le CLI `arc deploy` **vérifie l'isolation effective** : test automatique post-deploy `docker exec sandbox-* ping -c1 -W2 8.8.8.8` doit échouer.

## Conséquences
+ Compromission d'un agent IA ne donne pas accès direct à la BDD prod
+ Code malicieux exécuté en sandbox ne peut ni atteindre internet ni les autres containers
+ Test automatisé dans la CI ARC garantit que la régression d'isolation est détectée
- Communication inter-réseaux nécessite des points de jonction explicites (DeepAgents joint `ai_net` ET `sandbox_net`) — coût modéré
- Debugger des problèmes réseau devient plus complexe → mitigation : commande `arc network audit` qui dump la topologie

## Alternatives rejetées
- **Un seul réseau plat** — inacceptable côté sécurité, surface d'attaque énorme
- **Network policies Kubernetes** — overkill, K8s hors scope (cf. spec infra §1.3)
- **Firewall iptables manuel** — moins déclaratif, fragile face à `docker-compose down/up`

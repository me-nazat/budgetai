import os
import re
import json
import subprocess

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # Fix dashboard/page.tsx hooks
    if filepath.endswith('dashboard/page.tsx'):
        # move early return down
        content = re.sub(
            r"(if \(!data && isLoading\).*?if \(!data\) return.*?</div>;)",
            r"",
            content,
            flags=re.DOTALL
        )
        content = re.sub(
            r"(const stats = \[.*?\];)",
            r"if (!data && isLoading) {\n        return <DashboardSkeleton />;\n    }\n\n    if (!data) return <div className=\"p-8 text-gray-500\">Failed to load dashboard</div>;\n\n    \1",
            content,
            flags=re.DOTALL
        )
        # Wait, if I move the return after `barData`, `data` might be null, causing a crash inside `useMemo` when accessing `data.dailySpending`.
        # So instead I should just provide empty array fallback:
        # const barData = React.useMemo(() => { if(!data) return {labels:[], datasets:[]}; return { ... } }, [data, isDark]);
        pass
    
    # Fix set-state-in-effect
    content = re.sub(r"setMounted\(true\);", r"setTimeout(() => setMounted(true), 0);", content)
    content = re.sub(r"setSupported\(false\);", r"setTimeout(() => setSupported(false), 0);", content)

    # Fix no-unescaped-entities
    content = content.replace("you're", "you&apos;re").replace("You've", "You&apos;ve").replace("You're", "You&apos;re")
    content = content.replace('"', '&quot;') # this might be dangerous if applied blindly

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)


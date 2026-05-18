#!/usr/bin/env python3
"""
bigtech_ai_jobs.py
Collect AI/ML/Agent job listings from Big Tech + AI hot companies.
Approach: Use SearXNG search to find recent job postings.
Output: data/<YYYY-MM-DD>/bigtech_ai_jobs.json
"""

import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path
import urllib.request
import urllib.parse
import re

# Config
SEARXNG_URL = os.environ.get("SEARXNG_URL", "http://localhost:8888")
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"

TODAY = date.today().isoformat()
DATE_DIR = DATA_DIR / TODAY
DATE_DIR.mkdir(parents=True, exist_ok=True)

# Target companies
COMPANIES = [
    {"name": "Google", "slug": "google"},
    {"name": "Meta", "slug": "meta"},
    {"name": "OpenAI", "slug": "openai"},
    {"name": "Anthropic", "slug": "anthropic"},
    {"name": "xAI", "slug": "xai"},
    {"name": "Microsoft", "slug": "microsoft"},
    {"name": "Amazon", "slug": "amazon"},
    {"name": "Tesla", "slug": "tesla"},
    {"name": "Apple", "slug": "apple"},
    {"name": "Nvidia", "slug": "nvidia"},
    {"name": "Mistral AI", "slug": "mistral"},
    {"name": "Cohere", "slug": "cohere"},
    {"name": "Scale AI", "slug": "scale_ai"},
    {"name": "Databricks", "slug": "databricks"},
    {"name": "Snowflake", "slug": "snowflake"},
]

# Query templates
QUERIES = [
    "{company} AI Engineer hiring",
    "{company} Machine Learning Engineer",
    "{company} Research Scientist AI",
    "{company} ML Platform Engineer",
]

# M7 priority order
M7_PRIORITY = ["OpenAI", "Anthropic", "Google", "Meta", "Microsoft", "Amazon", "Tesla", "Apple", "xAI", "Nvidia"]

def search_jobs(query, limit=10):
    """Search for job postings using SearXNG."""
    url = f"{SEARXNG_URL}/search?q={urllib.parse.quote(query)}&format=json&language=en"
    
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            
            results = []
            for result in data.get("results", [])[:limit]:
                results.append({
                    "title": result.get("title", ""),
                    "url": result.get("url", ""),
                    "description": result.get("content", "")[:200],
                })
            return results
    except Exception as e:
        print(f"  [Search] Error for '{query}': {e}")
        return []

def extract_key_skills(title, description):
    """Extract AI/ML skills from job title and description."""
    text = f"{title} {description}".lower()
    skills = set()
    
    skill_map = [
        "LLM", "Agent", "RAG", "Vector DB", "PyTorch", "TensorFlow", "JAX",
        "CUDA", "Transformer", "ML", "AI", "Deep Learning", "NLP", "Computer Vision",
        "Python", "TypeScript", "Go", "Rust", "Kubernetes", "Docker", "AWS", "GCP", "Azure",
        "vLLM", "Triton", "Fine-tuning", "RLHF", "DPO", "Inference", "Training",
        "Neural Network", "GPU", "HPC", "MLOps", "Data Pipeline",
    ]
    
    for s in skill_map:
        if s.lower() in text:
            skills.add(s)
    
    return list(skills)[:6]

def classify_role(title):
    """Classify job role type."""
    t = title.lower()
    if "research" in t:
        return "Research"
    if any(w in t for w in ["infra", "platform", "systems"]):
        return "Infra/Platform"
    if any(w in t for w in ["ml engineer", "ai engineer"]):
        return "ML/AI Engineer"
    if "data scientist" in t:
        return "Data Scientist"
    if "product" in t:
        return "Product"
    if any(w in t for w in ["safety", "alignment"]):
        return "Safety/Alignment"
    if any(w in t for w in ["sales", "marketing", "business"]):
        return "Sales/Marketing"
    return "Engineering"

def is_job_result(result, company_name):
    """Check if a search result is actually a job posting."""
    url = result.get("url", "").lower()
    title = result.get("title", "").lower()
    desc = result.get("description", "").lower()
    
    # Must be from a job site or career page
    job_indicators = [
        "linkedin.com/jobs", "indeed.com", "glassdoor.com", "careers",
        "hiring", "job description", "apply", "position",
    ]
    
    # Check if it's from a relevant domain
    if not any(ind in url or ind in title for ind in job_indicators):
        return False
    
    # Must mention the company
    company_slug = company_name.lower()
    if company_slug not in title and company_slug not in url:
        return False
    
    return True

def main():
    all_jobs = []
    
    print(f"[BigTech Jobs] Searching for AI/ML jobs (date: {TODAY})...")
    
    for company in COMPANIES:
        company_name = company["name"]
        print(f"\n  [{company_name}] Searching...")
        
        for query_template in QUERIES:
            query = query_template.format(company=company_name)
            results = search_jobs(query, limit=8)
            
            for result in results:
                if not is_job_result(result, company_name):
                    continue
                
                # Skip if already seen
                url = result["url"]
                if any(j["url"] == url for j in all_jobs):
                    continue
                
                all_jobs.append({
                    "title": result["title"][:120],
                    "url": url,
                    "company": company_name,
                    "description": result.get("description", "")[:200],
                    "skills": extract_key_skills(result["title"], result.get("description", "")),
                    "role_type": classify_role(result["title"]),
                    "source": "web_search",
                })
            
            time.sleep(0.3)
    
    # Sort by company priority
    all_jobs.sort(key=lambda j: M7_PRIORITY.index(j["company"]) if j["company"] in M7_PRIORITY else 999)
    
    # Build output
    summary = {
        "by_company": {},
        "by_role": {},
        "by_source": {},
    }
    
    for job in all_jobs:
        company = job["company"]
        role = job["role_type"]
        source = job["source"]
        
        summary["by_company"][company] = summary["by_company"].get(company, 0) + 1
        summary["by_role"][role] = summary["by_role"].get(role, 0) + 1
        summary["by_source"][source] = summary["by_source"].get(source, 0) + 1
    
    payload = {
        "source": "bigtech_ai_jobs",
        "date": TODAY,
        "companies_targeted": [c["name"] for c in COMPANIES],
        "total_collected": len(all_jobs),
        "jobs": all_jobs,
        "summary": summary,
    }
    
    out_path = DATE_DIR / "bigtech_ai_jobs.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    
    print(f"\n[BigTech Jobs] Wrote {len(all_jobs)} jobs → {out_path}")
    print(f"  By company: {json.dumps(summary['by_company'])}")
    print(f"  By role: {json.dumps(summary['by_role'])}")

if __name__ == "__main__":
    main()

"""
Script to setup Elasticsearch indices and Kibana dashboards
Run this after deploying to configure ELK stack
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from elasticsearch import Elasticsearch
from app.core.config import settings


def create_index_template(es: Elasticsearch):
    """Create index template for expense tracker logs"""
    
    template = {
        "index_patterns": ["expense-tracker-logs-*"],
        "template": {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 1,
                "index.lifecycle.name": "expense-tracker-logs-policy",
                "index.lifecycle.rollover_alias": "expense-tracker-logs"
            },
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "event_type": {"type": "keyword"},
                    "application": {"type": "keyword"},
                    "environment": {"type": "keyword"},
                    "user_id": {"type": "integer"},
                    "message": {"type": "text"},
                    
                    # HTTP request fields
                    "method": {"type": "keyword"},
                    "path": {"type": "keyword"},
                    "status_code": {"type": "integer"},
                    "duration_ms": {"type": "float"},
                    "error": {"type": "text"},
                    
                    # Transaction fields
                    "transaction_type": {"type": "keyword"},
                    "amount": {"type": "float"},
                    "currency": {"type": "keyword"},
                    "category_id": {"type": "integer"},
                    
                    # Budget alert fields
                    "budget_limit": {"type": "float"},
                    "current_spending": {"type": "float"},
                    "percentage": {"type": "float"},
                    "alert_level": {"type": "keyword"},
                    
                    # AI query fields
                    "query": {"type": "text"},
                    "response_time_ms": {"type": "float"},
                    "success": {"type": "boolean"},
                    
                    # OCR fields
                    "processing_time_ms": {"type": "float"},
                    "extracted_amount": {"type": "float"}
                }
            }
        }
    }
    
    try:
        es.indices.put_index_template(
            name="expense-tracker-logs-template",
            body=template
        )
        print("✅ Index template created successfully")
    except Exception as e:
        print(f"❌ Error creating index template: {e}")


def create_ilm_policy(es: Elasticsearch):
    """Create Index Lifecycle Management policy"""
    
    policy = {
        "policy": {
            "phases": {
                "hot": {
                    "actions": {
                        "rollover": {
                            "max_age": "7d",
                            "max_size": "50gb"
                        }
                    }
                },
                "delete": {
                    "min_age": "30d",
                    "actions": {
                        "delete": {}
                    }
                }
            }
        }
    }
    
    try:
        es.ilm.put_lifecycle(
            name="expense-tracker-logs-policy",
            body=policy
        )
        print("✅ ILM policy created successfully")
    except Exception as e:
        print(f"❌ Error creating ILM policy: {e}")


def main():
    """Main setup function"""
    
    if not settings.ELASTICSEARCH_URL:
        print("❌ ELASTICSEARCH_URL not configured")
        return
    
    print(f"🔗 Connecting to Elasticsearch: {settings.ELASTICSEARCH_URL}")
    
    try:
        es = Elasticsearch(
            [settings.ELASTICSEARCH_URL],
            basic_auth=(
                settings.ELASTICSEARCH_USERNAME,
                settings.ELASTICSEARCH_PASSWORD
            ) if settings.ELASTICSEARCH_PASSWORD else None,
            verify_certs=True
        )
        
        # Test connection
        if not es.ping():
            print("❌ Cannot connect to Elasticsearch")
            return
        
        print("✅ Connected to Elasticsearch")
        
        # Get cluster info
        info = es.info()
        print(f"📊 Cluster: {info['cluster_name']}")
        print(f"📊 Version: {info['version']['number']}")
        
        # Create ILM policy
        print("\n📝 Creating ILM policy...")
        create_ilm_policy(es)
        
        # Create index template
        print("\n📝 Creating index template...")
        create_index_template(es)
        
        print("\n✅ ELK setup completed!")
        print(f"\n📊 Kibana URL: {settings.KIBANA_URL}")
        print("\n📋 Next steps:")
        print("1. Go to Kibana > Stack Management > Index Patterns")
        print("2. Create index pattern: expense-tracker-logs-*")
        print("3. Select @timestamp as time field")
        print("4. Go to Discover to view logs")
        print("5. Create visualizations and dashboards as needed")
        
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Load test script for WBR Actionizer transcoding endpoints.
Sends concurrent POST requests to /v1/meetings/:id/transcode to stress CPU.
"""

import asyncio
import httpx
import argparse
import time
import statistics
from typing import List

async def transcode_request(client: httpx.AsyncClient, base_url: str, jwt: str, meeting_id: str) -> dict:
    """Send a single transcode request and measure timing."""
    start_time = time.time()
    
    try:
        response = await client.post(
            f"{base_url}/v1/meetings/{meeting_id}/transcode",
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=300.0  # 5 minute timeout for transcoding
        )
        
        end_time = time.time()
        latency = end_time - start_time
        
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "latency": latency,
            "meeting_id": meeting_id
        }
    except Exception as e:
        end_time = time.time()
        latency = end_time - start_time
        
        return {
            "success": False,
            "status_code": 0,
            "latency": latency,
            "error": str(e),
            "meeting_id": meeting_id
        }

async def run_load_test(base_url: str, jwt: str, meeting_ids: List[str], 
                       concurrency: int, repeat: int) -> dict:
    """Run the load test with specified parameters."""
    
    all_meeting_ids = meeting_ids * repeat if repeat > 1 else meeting_ids
    total_requests = len(all_meeting_ids)
    
    print(f"Starting load test:")
    print(f"  Base URL: {base_url}")
    print(f"  Meeting IDs: {len(meeting_ids)} unique")
    print(f"  Total requests: {total_requests}")
    print(f"  Concurrency: {concurrency}")
    print(f"  Repeat factor: {repeat}")
    print()
    
    # Create semaphore to limit concurrency
    semaphore = asyncio.Semaphore(concurrency)
    
    async def bounded_request(client: httpx.AsyncClient, meeting_id: str):
        async with semaphore:
            return await transcode_request(client, base_url, jwt, meeting_id)
    
    # Run all requests
    start_time = time.time()
    
    async with httpx.AsyncClient() as client:
        tasks = [bounded_request(client, meeting_id) for meeting_id in all_meeting_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    end_time = time.time()
    total_time = end_time - start_time
    
    # Process results
    successful_results = [r for r in results if isinstance(r, dict) and r["success"]]
    failed_results = [r for r in results if isinstance(r, dict) and not r["success"]]
    exceptions = [r for r in results if not isinstance(r, dict)]
    
    latencies = [r["latency"] for r in successful_results]
    
    # Calculate statistics
    success_rate = len(successful_results) / total_requests * 100
    
    stats = {
        "total_requests": total_requests,
        "successful": len(successful_results),
        "failed": len(failed_results),
        "exceptions": len(exceptions),
        "success_rate": success_rate,
        "total_time": total_time,
        "requests_per_second": total_requests / total_time,
        "latency_stats": {
            "min": min(latencies) if latencies else 0,
            "max": max(latencies) if latencies else 0,
            "mean": statistics.mean(latencies) if latencies else 0,
            "median": statistics.median(latencies) if latencies else 0,
            "p95": statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else (max(latencies) if latencies else 0),
            "p99": statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else (max(latencies) if latencies else 0)
        }
    }
    
    return stats

def print_results(stats: dict):
    """Print formatted results."""
    print("\n" + "="*60)
    print("LOAD TEST RESULTS")
    print("="*60)
    print(f"Total Requests:     {stats['total_requests']}")
    print(f"Successful:         {stats['successful']}")
    print(f"Failed:             {stats['failed']}")
    print(f"Exceptions:         {stats['exceptions']}")
    print(f"Success Rate:       {stats['success_rate']:.1f}%")
    print(f"Total Time:         {stats['total_time']:.2f}s")
    print(f"Requests/Second:    {stats['requests_per_second']:.2f}")
    print()
    print("LATENCY STATISTICS (seconds):")
    print(f"  Min:              {stats['latency_stats']['min']:.2f}")
    print(f"  Max:              {stats['latency_stats']['max']:.2f}")
    print(f"  Mean:             {stats['latency_stats']['mean']:.2f}")
    print(f"  Median:           {stats['latency_stats']['median']:.2f}")
    print(f"  95th percentile:  {stats['latency_stats']['p95']:.2f}")
    print(f"  99th percentile:  {stats['latency_stats']['p99']:.2f}")
    print("="*60)

def main():
    parser = argparse.ArgumentParser(description="Load test WBR Actionizer transcoding")
    parser.add_argument("--base-url", default="http://localhost:8080", 
                       help="Base URL of the API server")
    parser.add_argument("--jwt", required=True, 
                       help="JWT token for authentication")
    parser.add_argument("--ids", required=True, 
                       help="Comma-separated list of meeting IDs")
    parser.add_argument("--concurrency", type=int, default=5, 
                       help="Number of concurrent requests")
    parser.add_argument("--repeat", type=int, default=1, 
                       help="How many times to repeat the meeting IDs list")
    
    args = parser.parse_args()
    
    meeting_ids = [id.strip() for id in args.ids.split(",") if id.strip()]
    
    if not meeting_ids:
        print("Error: No valid meeting IDs provided")
        return
    
    print(f"Parsed {len(meeting_ids)} meeting IDs: {meeting_ids}")
    
    # Run the async load test
    stats = asyncio.run(run_load_test(
        args.base_url, 
        args.jwt, 
        meeting_ids, 
        args.concurrency, 
        args.repeat
    ))
    
    print_results(stats)

if __name__ == "__main__":
    main()
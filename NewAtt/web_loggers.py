from flask import request
from logger import logger

def log_request():
    real_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    logger.debug(f"[{real_ip} -> {request.path}] ({request.method})")

def log_response(response):
    # match response.status_code // 100:
    #     case 2:
    #         color = GREEN_TEXT_BRIGHT
    #     case 3:
    #         if response.status_code == 304:
    #             color = GREEN_TEXT
    #         else:
    #             color = YELLOW_TEXT
    #     case 4 | 5:
    #         if response.status_code == 429:
    #             color = YELLOW_TEXT_BRIGHT
    #         elif response.status_code == 404:
    #             color = RED_TEXT
    #         else:
    #             color = RED_TEXT_BRIGHT
    #     case _:
    #         color = YELLOW_TEXT_BRIGHT
    real_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    logger.info(f"[{real_ip} -> {request.path}] ({request.method}) {response.status}")
    # print(f"[{real_ip} -> {request.path}] ({YELLOW_TEXT_BRIGHT}{request.method}{RESET_TEXT}) {color}{response.status}{RESET_TEXT}")

    return response
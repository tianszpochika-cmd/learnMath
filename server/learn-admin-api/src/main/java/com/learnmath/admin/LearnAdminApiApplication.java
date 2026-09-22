package com.learnmath.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 管理域 API（learn-admin-api · 02 §4.1）。端口 8081，前缀 /api/admin/v1。
 * common 与 app 模块同构复制（设计未含共享模块；如需抽取在 Z-02 文档回写时提 ADR）。
 */
@SpringBootApplication
public class LearnAdminApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(LearnAdminApiApplication.class, args);
    }
}

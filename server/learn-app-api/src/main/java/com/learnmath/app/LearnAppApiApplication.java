package com.learnmath.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 学员域 API（learn-app-api · 02 §4.1 双模块之 audience=learner）。
 * 端口 8080，前缀 /api/app/v1（04 §1）。
 */
@SpringBootApplication
public class LearnAppApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(LearnAppApiApplication.class, args);
    }
}
